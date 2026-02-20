/**
 * voice/server.ts
 *
 * Bun WebSocket server — Text In → Gemini → Inworld TTS → Audio Out
 *
 * Protocol:
 *   Client  → Server : UTF-8 text message      (the user's prompt)
 *   Server  → Client : UTF-8 "READY:24000"      (signals ready + sample rate)
 *   Server  → Client : binary frames             (raw LINEAR16 PCM, mono, 24 kHz)
 *   Server  → Client : UTF-8 "DONE"             (signals end of audio stream)
 *   Server  → Client : UTF-8 "ERROR: ..."       (on failure)
 *
 * Run:
 *   bun voice/server.ts
 */

import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { Inworld } from "./inworld";
import { LEGAL_SYSTEM_INSTRUCTION } from "./prompts";

/** Basic message structure for conversation history */
type CoreMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

const PORT = Number(process.env.PORT ?? 3001);

/* ------------------------------------------------------------------ */
/*  Per-connection state                                                */
/* ------------------------------------------------------------------ */

interface ClientState {
  inworld: Inworld;
  /** True while a Gemini → TTS pipeline is running */
  busy: boolean;
  messages: CoreMessage[];
  abortController: AbortController | null;
}

const clients = new Map<string, ClientState>();

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function clientId(ws: { data: { id: string } }): string {
  return ws.data.id;
}

async function buildClient(): Promise<ClientState> {
  const inworld = new Inworld({
    apiKey: process.env.INWORLD_API_KEY!,
    voiceId: "Blake",
    modelId: "inworld-tts-1.5-mini",
    encoding: "LINEAR16",
    sampleRate: 24000,
  });

  await inworld.connect();

  return { inworld, busy: false, messages: [], abortController: null };
}

/* ------------------------------------------------------------------ */
/*  Pipeline: text → Gemini stream → Inworld TTS → audio frames        */
/* ------------------------------------------------------------------ */

/**
 * After all text has been flushed to Inworld, wait until 800ms passes
 * with no new audio chunk (silence detection) before resolving.
 * Each chunk received is forwarded to the client immediately.
 */
function waitForSilence(
  inworld: Inworld,
  ws: import("bun").ServerWebSocket<{ id: string }>,
  silenceMs = 800,
): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(resolve, silenceMs);
    };

    // Override audio handler: forward chunks + reset silence timer
    inworld.onAudio((chunk) => {
      try {
        ws.sendBinary(chunk);
      } catch {
        /* disconnected */
      }
      reset();
    });

    // Start the initial timer (handles case where no audio arrives at all)
    reset();
  });
}

async function runPipeline(
  ws: import("bun").ServerWebSocket<{ id: string }>,
  state: ClientState,
  prompt: string,
) {
  if (state.busy) {
    console.log(`[${clientId(ws)}] 🛑 Interrupting active request`);
    state.abortController?.abort();
    ws.send("INTERRUPT");
  }

  state.busy = true;
  state.abortController = new AbortController();

  try {
    console.log(`[${clientId(ws)}] ➡️  Prompt: "${prompt}"`);

    // Add user message to history
    state.messages.push({ role: "user", content: prompt });

    const result = await streamText({
      model: google("gemini-2.0-flash"),
      messages: state.messages,
      abortSignal: state.abortController.signal,
      temperature: 0.2,
      system: LEGAL_SYSTEM_INSTRUCTION({
        user: "User",
        instructor: "Kelly",
      }),
      onAbort(event) {
        console.log(`[${clientId(ws)}] ❌ LLM aborted:`, event);
      },
    });

    let firstToken = true;
    let fullResponse = "";
    let isInsideCue = false;
    const startLLM = performance.now();

    for await (const delta of result.textStream) {
      if (firstToken) {
        console.log(
          `[${clientId(ws)}] ⚡ LLM first token: ${(performance.now() - startLLM).toFixed(1)}ms`,
        );
        firstToken = false;
      }

      fullResponse += delta;
      state.inworld.push(delta);

      // Filter cues (e.g., [sigh]) from client transcription
      let filteredDelta = "";
      for (const char of delta) {
        if (char === "[") {
          isInsideCue = true;
          continue;
        }
        if (char === "]") {
          isInsideCue = false;
          continue;
        }
        if (!isInsideCue) {
          filteredDelta += char;
        }
      }

      if (filteredDelta) {
        ws.send(`TEXT:${filteredDelta}`);
      }
    }

    // Add assistant response to history
    state.messages.push({ role: "assistant", content: fullResponse });

    console.log(
      `[${clientId(ws)}] ✅ LLM done in ${(performance.now() - startLLM).toFixed(1)}ms`,
    );

    // Flush remaining partial sentence, then wait for audio silence
    await state.inworld.flush();
    await waitForSilence(state.inworld, ws);

    console.log(`[${clientId(ws)}] 🔊 Audio stream complete`);
    ws.send("DONE");
  } catch (err) {
    console.error(`[${clientId(ws)}] ❌ Pipeline error:`, err);
    ws.send(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    state.busy = false;
  }
}

/* ------------------------------------------------------------------ */
/*  Bun WebSocket server                                                */
/* ------------------------------------------------------------------ */

const server = Bun.serve<{ id: string }>({
  port: PORT,

  fetch(req, server) {
    const id = crypto.randomUUID();
    const upgraded = server.upgrade(req, { data: { id } });
    console.log("Ip", req.headers.get("cf-connecting-ip"));
    if (upgraded) return;
    return new Response("WebSocket endpoint. Connect via ws://", {
      status: 426,
    });
  },

  websocket: {
    // Called once per connection — initialise Inworld for this client
    async open(ws) {
      console.log(`[${ws.data.id}] 🔌 Client connected`);
      try {
        const state = await buildClient();
        clients.set(ws.data.id, state);
        console.log(`[${ws.data.id}] ✅ Inworld TTS ready`);
        ws.send("READY:24000"); // include sample rate for client
      } catch (err) {
        console.error(`[${ws.data.id}] ❌ Failed to connect Inworld:`, err);
        ws.send(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
        ws.close();
      }
    },

    // Called for each incoming message (the user's text prompt)
    async message(ws, rawMessage) {
      const state = clients.get(ws.data.id);
      if (!state) {
        ws.send("ERROR: session not initialised");
        return;
      }

      const prompt =
        typeof rawMessage === "string"
          ? rawMessage.trim()
          : Buffer.from(rawMessage as unknown as ArrayBuffer)
              .toString("utf-8")
              .trim();

      if (!prompt) return;

      await runPipeline(ws, state, prompt);
    },

    // Clean up when the client disconnects
    close(ws) {
      const state = clients.get(ws.data.id);
      if (state) {
        state.inworld.destroy();
        clients.delete(ws.data.id);
      }
      console.log(`[${ws.data.id}] 🔌 Client disconnected`);
    },
  },
});
console.log(server.hostname);
console.log(
  `🚀 Voice WebSocket server listening on ws://${server.hostname}:${PORT}`,
);
