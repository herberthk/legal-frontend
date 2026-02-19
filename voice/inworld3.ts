// inworld.bun.ts
// Optimized for Bun runtime

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------

export interface InworldConfig {
  apiKey: string;
  voiceId?: VoiceId;
  modelId: ModelId;
  audioEncoding?: "OGG_OPUS" | "PCM" | "MP3";
  sampleRate?: number;
  bitRate?: number;
  connectionTimeout?: number;
}

type VoiceId =
  | "Dennis"
  | "Blake"
  | "Sarah"
  | "Luna"
  | "Hana"
  | "Mark"
  | "Hades";

type ModelId = "inworld-tts-1.5-max" | "inworld-tts-1.5-mini";

export interface AudioChunk {
  data: Uint8Array;
}

// -------------------------------------------------------------
// Internal Context State
// -------------------------------------------------------------

interface ContextState {
  queue: Uint8Array[];
  resolve?: () => void;
  done: boolean;
  error?: Error;
  abort?: AbortSignal;
}

// -------------------------------------------------------------
// InworldConnection (Bun Optimized)
// -------------------------------------------------------------

export class InworldConnection {
  private ws: WebSocket | null = null;
  private readonly config: Required<InworldConfig>;
  private contexts = new Map<string, ContextState>();
  private manuallyClosed = false;

  private readonly MAX_QUEUE = 200;

  constructor(config: InworldConfig) {
    if (!config.apiKey || !config.modelId) {
      throw new Error("apiKey and modelId are required");
    }

    this.config = {
      voiceId: config.voiceId ?? "Luna",
      audioEncoding: config.audioEncoding ?? "OGG_OPUS",
      sampleRate: config.sampleRate ?? 24000,
      bitRate: config.bitRate ?? 32000,
      connectionTimeout: config.connectionTimeout ?? 10000,
      ...config,
    };
  }

  // -------------------------------------------------------------
  // Connect
  // -------------------------------------------------------------

  async connect(): Promise<this> {
    if (this.ws?.readyState === WebSocket.OPEN) return this;

    this.manuallyClosed = false;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
        this.cleanup();
      }, this.config.connectionTimeout);

      const ws = new WebSocket(
        "wss://api.inworld.ai/tts/v1/voice:streamBidirectional",
        {
          //@ts-ignore
          headers: {
            Authorization: `Basic ${this.config.apiKey}`,
          },
        },
      );

      ws.onopen = () => {
        clearTimeout(timeout);
        this.ws = ws;
        resolve(this);
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error("WebSocket error"));
        this.cleanup();
      };

      ws.onclose = () => {
        if (!this.manuallyClosed) {
          // Optional auto-reconnect logic
        }
        this.cleanup();
      };

      ws.onmessage = (event) => {
        const raw =
          typeof event.data === "string"
            ? event.data
            : Buffer.from(event.data).toString();
        this.handleMessage(raw);
      };
    });
  }

  // Ensure connection is open
  async ensureConnection() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
  }
  // -------------------------------------------------------------
  // Streaming TTS (Multi-context, Bun optimized)
  // -------------------------------------------------------------

  async *synthesizeStreaming(
    chunks: AsyncIterable<string>,
    options?: { signal?: AbortSignal },
  ): AsyncGenerator<AudioChunk> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      //   throw new Error("WebSocket not connected");
      await this.connect();
    }

    const contextId = crypto.randomUUID();

    const state: ContextState = {
      queue: [],
      done: false,
      abort: options?.signal,
    };

    this.contexts.set(contextId, state);

    if (options?.signal) {
      if (options.signal.aborted) {
        throw new Error("Aborted");
      }

      options.signal.addEventListener("abort", () => {
        this.closeContext(contextId);
        state.error = new Error("Aborted");
        state.done = true;
        state.resolve?.();
      });
    }

    // Send create
    this.ws?.send(
      JSON.stringify({
        context_id: contextId,
        create: {
          voice_id: this.config.voiceId,
          model_id: this.config.modelId,
          audio_config: {
            audio_encoding: this.config.audioEncoding,
            sample_rate_hertz: this.config.sampleRate,
            bit_rate: this.config.bitRate,
          },
        },
      }),
    );

    // Send chunks in background
    (async () => {
      try {
        for await (const chunk of chunks) {
          if (!chunk.trim()) continue;

          this.ws?.send(
            JSON.stringify({
              context_id: contextId,
              send_text: {
                text: chunk,
                flush_context: {},
              },
            }),
          );
        }

        this.closeContext(contextId);
      } catch (err) {
        state.error = err as Error;
        state.done = true;
        state.resolve?.();
      }
    })();

    // Yield audio with backpressure control
    while (!state.done || state.queue.length > 0) {
      if (state.queue.length === 0) {
        await new Promise<void>((res) => (state.resolve = res));
      }

      while (state.queue.length > 0) {
        yield { data: state.queue.shift()! };
      }
    }

    if (state.error) throw state.error;

    this.contexts.delete(contextId);
  }

  // -------------------------------------------------------------
  // Handle incoming messages
  // -------------------------------------------------------------

  private handleMessage(raw: string) {
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    // Since Inworld does NOT return context_id,
    // just use the only active context

    const state = [...this.contexts.values()][0];
    if (!state) return;

    if (data.error) {
      state.error = new Error(data.error.message);
      state.done = true;
      state.resolve?.();
      return;
    }

    const result = data.result;

    if (result?.audioChunk?.audioContent) {
      const buffer = Buffer.from(result.audioChunk.audioContent, "base64");

      state.queue.push(buffer);
      state.resolve?.();
    }

    if (result?.contextClosed || data.done === true) {
      state.done = true;
      state.resolve?.();
    }
  }

  private closeContext(contextId: string) {
    if (!this.ws) return;

    this.ws.send(
      JSON.stringify({
        context_id: contextId,
        close_context: {},
      }),
    );
  }

  // -------------------------------------------------------------
  // Close
  // -------------------------------------------------------------

  async close() {
    this.manuallyClosed = true;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    for (const [, state] of this.contexts) {
      state.done = true;
      state.error = new Error("Connection closed");
      state.resolve?.();
    }

    this.contexts.clear();
  }

  private cleanup() {
    if (this.ws) {
      this.ws = null;
    }

    for (const [, state] of this.contexts) {
      state.done = true;
      state.error = new Error("Connection lost");
      state.resolve?.();
    }

    this.contexts.clear();
  }
}

// -------------------------------------------------------------
// Factory
// -------------------------------------------------------------

class Inworld {
  constructor(private config: InworldConfig) {}

  async connect(): Promise<InworldConnection> {
    const conn = new InworldConnection(this.config);
    await conn.connect();
    return conn;
  }
}

export default Inworld;
