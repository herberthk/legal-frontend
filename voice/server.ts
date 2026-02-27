/**
 * voice/server.ts
 *
 * Bun WebSocket server — Text In → Gemini → Inworld TTS → Audio Out
 *
 * Protocol:
 *   Client  → Server : UTF-8 text message      (the user's prompt)
 *   Server  → Client : UTF-8 "READY:24000"      (signals ready + sample rate)
 *   Server  → Client : UTF-8 "START_TURN"       (signals audio for a new turn is starting)
 *   Server  → Client : UTF-8 "TEXT:..."         (streaming transcript)
 *   Server  → Client : binary frames             (raw LINEAR16 PCM, mono, 24/48 kHz)
 *   Server  → Client : UTF-8 "DONE"             (signals end of audio stream)
 *   Server  → Client : UTF-8 "INTERRUPT"        (signals previous turn was cancelled)
 */

import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { Inworld } from "./inworld";
import { LEGAL_SYSTEM_INSTRUCTION } from "./prompts";

type CoreMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

const PORT = Number(process.env.PORT ?? 3001);
const MAX_HISTORY_MESSAGES = 12;

interface ClientState {
  inworld: Inworld;
  busy: boolean;
  messages: CoreMessage[];
  abortController: AbortController | null;
  /** Ensures turns are processed serially to prevent audio mixing */
  pipelineLock: Promise<void>;
}

const clients = new Map<string, ClientState>();

function clientId(ws: { data: { id: string } }): string {
  return ws.data.id;
}

async function buildClient(): Promise<ClientState> {
  const inworld = new Inworld({
    apiKey: process.env.INWORLD_API_KEY!,
    voiceId: "Celeste",
    modelId: "inworld-tts-1.5-max",
    sampleRate: 48000,
    debug: true,
  });

  await inworld.connect();

  return {
    inworld,
    busy: false,
    messages: [],
    abortController: null,
    pipelineLock: Promise.resolve(),
  };
}

/**
 * Wait for silence on the Inworld audio stream.
 */
function waitForSilence(
  inworld: Inworld,
  ws: import("bun").ServerWebSocket<{ id: string }>,
  silenceMs = 800,
  abortSignal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timer);
      if (abortSignal) {
        abortSignal.removeEventListener("abort", onAbort);
      }
    };

    const onAbort = () => {
      cleanup();
      resolve(); // Resolve immediately on abort to release the Turn Lock
    };

    if (abortSignal?.aborted) return onAbort();
    abortSignal?.addEventListener("abort", onAbort);

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        cleanup();
        resolve();
      }, silenceMs);
    };

    inworld.onAudio((chunk) => {
      try {
        ws.sendBinary(chunk);
      } catch {
        /* disconnected */
      }
      reset();
    });

    reset();
  });
}

async function runPipeline(
  ws: import("bun").ServerWebSocket<{ id: string }>,
  state: ClientState,
  prompt: string,
) {
  // If a pipeline is already running, abort it and signal the client to purge its audio buffer.
  if (state.busy) {
    console.log(`[${clientId(ws)}] 🛑 Interrupting active request`);
    state.abortController?.abort();
    // Don't await resetContext here! It might hang if Turn 1 hasn't released the lock.
    // The reset will happen at the start of Turn 2's lock execution.
    ws.send("INTERRUPT");
  }

  // Serialize pipeline execution so Utterance 2 never begins until Utterance 1 cleanup is in finally{}
  state.pipelineLock = state.pipelineLock.then(async () => {
    state.busy = true;
    state.abortController = new AbortController();

    try {
      console.log(`[${clientId(ws)}] ➡️  Turn Start: "${prompt}"`);

      // 1. Reset Inworld context (purge old audio generation)
      await state.inworld.resetContext();

      // 2. Register audio handler EARLY for low-latency streaming
      state.inworld.onAudio((chunk) => {
        try {
          if (state.inworld.debug) {
            console.log(
              `[${clientId(ws)}] 🔊 Forwarding chunk (${chunk.length} bytes)`,
            );
          }
          ws.sendBinary(chunk);
        } catch {
          /* disconnected */
        }
      });

      // 3. Signal client that audio for a NEW turn is officially starting
      ws.send("START_TURN");

      state.messages.push({ role: "user", content: prompt });

      const result = await streamText({
        model: google("gemini-2.0-flash"),
        messages: state.messages,
        abortSignal: state.abortController.signal,
        system: LEGAL_SYSTEM_INSTRUCTION({
          user: "Herbert",
          instructor: "Kelly",
        }),
      });

      let firstToken = true;
      let fullResponse = "";
      let isInsideCue = false;
      const startLLM = performance.now();

      for await (const delta of result.textStream) {
        fullResponse += delta;
        state.inworld.push(delta);

        if (firstToken) {
          console.log(
            `[${clientId(ws)}] ⚡ TTFT: ${(performance.now() - startLLM).toFixed(1)}ms`,
          );
          firstToken = false;
        }

        // Filter and send text tokens
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
          if (!isInsideCue) filteredDelta += char;
        }
        if (filteredDelta) ws.send(`TEXT:${filteredDelta}`);
      }

      state.messages.push({ role: "assistant", content: fullResponse });
      if (state.messages.length > MAX_HISTORY_MESSAGES) {
        state.messages = state.messages.slice(-MAX_HISTORY_MESSAGES);
      }

      // 4. Final flush and silence detection
      await state.inworld.flush();
      await waitForSilence(
        state.inworld,
        ws,
        800,
        state.abortController.signal,
      );

      console.log(`[${clientId(ws)}] 🔊 Turn Complete`);
      ws.send("DONE");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log(`[${clientId(ws)}] ↩️ Turn Aborted — pruning history`);
        // Remove the user prompt that was never answered
        state.messages.pop();
        return;
      }
      console.error(`[${clientId(ws)}] ❌ Pipeline Error:`, err);
      ws.send(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      state.busy = false;
    }
  });
}

Bun.serve<{ id: string }>({
  port: PORT,
  fetch(req, server) {
    const id = crypto.randomUUID();
    const upgraded = server.upgrade(req, { data: { id } });
    if (upgraded) return;
    return new Response("WebSocket API", { status: 426 });
  },
  websocket: {
    async open(ws) {
      console.log(`[${ws.data.id}] 🔌 Connected`);
      try {
        const state = await buildClient();
        clients.set(ws.data.id, state);
        ws.send("READY:48000");
        await runPipeline(ws, state, "Hello!");
      } catch (err) {
        console.error(`[${ws.data.id}] ❌ Init failed:`, err);
        ws.close();
      }
    },
    async message(ws, raw) {
      const state = clients.get(ws.data.id);
      if (!state) return;
      const prompt =
        typeof raw === "string" ? raw : Buffer.from(raw).toString("utf-8");
      if (prompt.trim()) await runPipeline(ws, state, prompt.trim());
    },
    close(ws) {
      const state = clients.get(ws.data.id);
      if (state) {
        state.abortController?.abort();
        state.inworld.destroy();
      }
      clients.delete(ws.data.id);
      console.log(`[${ws.data.id}] 🔌 Disconnected`);
    },
  },
});

console.log(`🚀 Voice Server: ws://localhost:${PORT}`);
