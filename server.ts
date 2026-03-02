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
import { Inworld } from "@/sevices";
import { LEGAL_SYSTEM_INSTRUCTION } from "@/constants";
import { parseCookies } from "@/utils";

const PORT = Number(process.env.PORT ?? 8000);
const MAX_HISTORY_MESSAGES = 8;

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
//Evelyn, Brake, Luna
const buildClient = async (voiceId: VoiceId): Promise<ClientState> => {
  const inworld = new Inworld({
    apiKey: process.env.INWORLD_API_KEY!,
    voiceId,
    modelId: "inworld-tts-1.5-mini",
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
};

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

const runPipeline = async (
  ws: import("bun").ServerWebSocket<{ id: string; session: Session }>,
  state: ClientState,
  prompt: string,
) => {
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
      // console.log("session", ws.data.session);
      const user = ws.data?.session?.name.split(" ")[0]! || "User";
      // console.log("user", user);
      const result = await streamText({
        // model: google("gemini-2.5-flash"),
        model: google("gemini-2.0-flash"),
        // model: google("gemini-3-flash-preview"),
        messages: state.messages,
        abortSignal: state.abortController.signal,
        system: LEGAL_SYSTEM_INSTRUCTION({
          user,
          instructor: "Kelly",
        }),
        // providerOptions: {
        //   google: {
        //     thinkingConfig: {
        //       //Gemini 2.5 Flash
        //       // thinkingBudget: 0,
        //       //Gemini 3 Flash
        //       thinkingLevel: "minimal",
        //     },
        //   },
        // },
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
      // console.log("History:", state.messages);
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
};

type Session = {
  id: string;
  name: string;
  email: string;
  voice: VoiceId;
} | null;

type Timer = {
  startTime: number;
  ticker: NodeJS.Timeout;
} | null;

Bun.serve<{ id: string; session: Session; timer: Timer }>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    const voice = url.searchParams.get("voice");
    const cookies = parseCookies(req.headers.get("cookie") || "");
    const sessionRaw = cookies.session;
    let session: Session | null = null;
    if (sessionRaw) {
      try {
        session = JSON.parse(sessionRaw);
      } catch {}
    }

    if (!session || !voice) {
      return new Response("Unauthorized", { status: 401 });
    }
    // Only pick id, name and email
    session = {
      id: session.id,
      name: session.name,
      email: session.email,
      voice: voice as VoiceId,
    };
    // const session = await redis.get(sessionRaw);
    // if (!session) {
    //   return new Response("Unauthorized", { status: 401 });
    // }
    const id = crypto.randomUUID();
    const upgraded = server.upgrade(req, {
      data: { id, session, timer: null },
    });
    if (upgraded) return;
    return new Response("WebSocket API", { status: 426 });
  },
  websocket: {
    idleTimeout: 60, // 60 seconds
    maxPayloadLength: 1024 * 500, // 500 KB

    async open(ws) {
      console.log(`[${ws.data.id}] 🔌 Connected`);
      if (!ws.data.session) {
        ws.close(1011, "Session not found");
        return;
      }
      try {
        console.log("voice", ws.data.session.voice);
        const state = await buildClient(ws.data.session.voice);
        clients.set(ws.data.id, state);
        ws.send("READY:48000");
        await runPipeline(ws, state, "Hello!");
        ws.data.timer = {
          startTime: Date.now(),
          ticker: setInterval(() => {
            const elapsedMs = Date.now() - ws.data.timer!.startTime;
            const seconds = Math.floor(elapsedMs / 1000);
            // console.log(`[${ws.data.id}] ⏰ Elapsed: ${seconds}s`);
            ws.send(`TIME:${seconds}`);
          }, 1000),
        };
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
      if (ws.data.timer) {
        clearInterval(ws.data.timer.ticker);
        const durationMs = Date.now() - ws.data.timer.startTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = ((durationMs % 60000) / 1000).toFixed(1);
        console.log(
          `✅ [${ws.data.id}] Connection Closed. Total time: ${minutes}m ${seconds}s`,
        );
      }
      const state = clients.get(ws.data.id);

      if (state) {
        state.abortController?.abort();
        state.inworld.destroy();
        state.messages = [];
      }
      clients.delete(ws.data.id);
      ws.data.session = null;
      // console.log("state after", state?.messages);

      console.log(`[${ws.data.id}] 🔌 Disconnected`);
    },
  },
});

console.log(`🚀 Voice Server: ws://localhost:${PORT}`);
