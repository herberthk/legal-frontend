// inworld.ts
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export interface InworldConfig {
  apiKey: string;
  voiceId?: VoiceId;
  modelId: ModelId;
  audioEncoding?: "OGG_OPUS" | "PCM" | "MP3";
  sampleRate?: number;
  bitRate?: number;
  autoSplitSentences?: boolean;
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
  data: Buffer; // Uint8Array compatible
  sequence?: number;
}

// Internal message types (unchanged)
interface CreateMessage {
  context_id: string;
  create: {
    voice_id: VoiceId;
    model_id?: ModelId;
    audio_config: {
      audio_encoding: string;
      sample_rate_hertz: number;
      bit_rate?: number;
    };
  };
}

interface SendTextMessage {
  context_id: string;
  send_text: {
    text: string;
    flush_context: Record<string, never>;
  };
}

interface CloseContextMessage {
  context_id: string;
  close_context: Record<string, never>;
}

// Response types
interface ContextCreatedResponse {
  result: { contextCreated: Record<string, never> };
}

interface AudioChunkResponse {
  result: { audioChunk: { audioContent: string } };
}

interface ContextClosedResponse {
  result: { contextClosed: Record<string, never> };
}

interface ErrorResponse {
  error: { message: string; code?: number };
}

type InworldResponse =
  | ContextCreatedResponse
  | AudioChunkResponse
  | ContextClosedResponse
  | ErrorResponse
  | { done: boolean };

// ----------------------------------------------------------------------
// InworldConnection – one WebSocket per instance
// ----------------------------------------------------------------------

export class InworldConnection extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly apiKey: string;
  private readonly voiceId: VoiceId;
  private readonly modelId: ModelId;
  private readonly audioEncoding: "OGG_OPUS" | "PCM" | "MP3";
  private readonly sampleRate: number;
  private readonly bitRate: number;
  private readonly autoSplitSentences: boolean;
  private readonly connectionTimeout: number;

  private activeSynthesis: {
    contextId: string;
  } | null = null;

  constructor(config: InworldConfig) {
    super();
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId ?? "Luna";
    this.modelId = config.modelId;
    this.audioEncoding = config.audioEncoding ?? "OGG_OPUS";
    this.sampleRate = config.sampleRate ?? 24000;
    this.bitRate = config.bitRate ?? 32000;
    this.autoSplitSentences = config.autoSplitSentences ?? true;
    this.connectionTimeout = config.connectionTimeout ?? 10000;

    if (!this.modelId || !this.apiKey) {
      throw new Error("Model ID and API Key are required");
    }
  }

  /**
   * Establishes the WebSocket connection.
   * Resolves when the connection is open, rejects on timeout or error.
   */
  async connect(): Promise<this> {
    if (this.ws?.readyState === WebSocket.OPEN) return this;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
        this.cleanup();
      }, this.connectionTimeout);

      try {
        const url = "wss://api.inworld.ai/tts/v1/voice:streamBidirectional";
        this.ws = new WebSocket(url, {
          //@ts-ignore
          headers: { Authorization: `Basic ${this.apiKey}` },
        });

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.emit("connected");
          resolve(this);
        };

        this.ws.onerror = (event) => {
          clearTimeout(timeout);
          const errorMessage =
            event instanceof ErrorEvent ? event.message : "WebSocket error";
          reject(new Error(errorMessage));
          this.cleanup();
        };

        this.ws.onclose = () => {
          this.emit("disconnected");
          this.cleanup();
        };

        this.ws.onmessage = (event) => {
          const data =
            typeof event.data === "string"
              ? event.data
              : Buffer.from(event.data).toString();
          this.handleMessage(data);
        };
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
        this.cleanup();
      }
    });
  }

  /**
   * Speaks the given text, emitting 'audio' events for each chunk,
   * 'done' when finished, and 'error' if something goes wrong.
   *
   * @param text - The text to synthesize
   * @throws If another synthesis is already in progress on this connection.
   */
  speak(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected. Call connect() first.");
    }
    if (this.activeSynthesis) {
      throw new Error(
        "Another synthesis is already in progress on this connection",
      );
    }

    const contextId = randomUUID();
    this.activeSynthesis = { contextId };

    // Send create context message
    const createMsg: CreateMessage = {
      context_id: contextId,
      create: {
        voice_id: this.voiceId,
        model_id: this.modelId,
        audio_config: {
          audio_encoding: this.audioEncoding,
          sample_rate_hertz: this.sampleRate,
          bit_rate: this.bitRate,
        },
      },
    };
    this.ws.send(JSON.stringify(createMsg));

    // Split text into sentences (if enabled) and send each
    const sentences = this.autoSplitSentences
      ? this.splitSentences(text)
      : [text];

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      const sendMsg: SendTextMessage = {
        context_id: contextId,
        send_text: { text: sentence, flush_context: {} },
      };
      this.ws.send(JSON.stringify(sendMsg));
    }

    // Close context to signal end of input
    const closeMsg: CloseContextMessage = {
      context_id: contextId,
      close_context: {},
    };
    this.ws.send(JSON.stringify(closeMsg));
  }

  /**
   * Streams audio for an async iterable of text chunks.
   * Each chunk is sent to the TTS as soon as it becomes available.
   * @param chunks - Async iterable that yields text strings
   * @yields AudioChunk as soon as they are produced by the TTS
   */
  async *synthesizeStreaming(
    chunks: AsyncIterable<string>,
  ): AsyncGenerator<AudioChunk> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected. Call connect() first.");
    }
    if (this.activeSynthesis) {
      throw new Error(
        "Another synthesis is already in progress on this connection",
      );
    }

    const contextId = randomUUID();
    const queue: AudioChunk[] = [];
    let queueResolve: (() => void) | null = null;
    let synthesisDone = false;
    let synthesisError: Error | null = null;

    // Set active synthesis so handleMessage processes incoming messages
    this.activeSynthesis = { contextId };

    // Event listeners to capture audio, done, and error
    const onAudio = (data: Buffer) => {
      queue.push({ data });
      if (queueResolve) {
        queueResolve();
        queueResolve = null;
      }
    };

    const onDone = () => {
      synthesisDone = true;
      if (queueResolve) {
        queueResolve();
        queueResolve = null;
      }
      // Clean up listeners
      this.off("audio", onAudio);
      this.off("done", onDone);
      this.off("error", onError);
    };

    const onError = (err: Error) => {
      synthesisError = err;
      if (queueResolve) {
        queueResolve();
        queueResolve = null;
      }
      this.off("audio", onAudio);
      this.off("done", onDone);
      this.off("error", onError);
    };

    this.on("audio", onAudio);
    this.once("done", onDone);
    this.once("error", onError);

    // Send create context message
    const createMsg: CreateMessage = {
      context_id: contextId,
      create: {
        voice_id: this.voiceId,
        model_id: this.modelId,
        audio_config: {
          audio_encoding: this.audioEncoding,
          sample_rate_hertz: this.sampleRate,
          bit_rate: this.bitRate,
        },
      },
    };
    this.ws.send(JSON.stringify(createMsg));

    // Background task: send text chunks as they arrive
    (async () => {
      try {
        for await (const chunk of chunks) {
          if (!chunk.trim()) continue;
          const sendMsg: SendTextMessage = {
            context_id: contextId,
            send_text: { text: chunk, flush_context: {} },
          };
          this.ws!.send(JSON.stringify(sendMsg));
        }
      } catch (err) {
        onError(err as Error);
        return;
      }

      // All chunks sent – close the context
      const closeMsg: CloseContextMessage = {
        context_id: contextId,
        close_context: {},
      };
      this.ws!.send(JSON.stringify(closeMsg));
    })();

    // Stream audio chunks as they arrive
    try {
      while (!synthesisDone && !synthesisError) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            queueResolve = resolve;
          });
        }
        while (queue.length > 0) {
          yield queue.shift()!;
        }
      }
      if (synthesisError) throw synthesisError;
    } finally {
      // Ensure listeners are removed and active synthesis is cleared
      this.off("audio", onAudio);
      this.off("done", onDone);
      this.off("error", onError);
      if (this.activeSynthesis?.contextId === contextId) {
        this.activeSynthesis = null;
      }
    }
  }
  /**
   * Gracefully closes the WebSocket connection.
   */
  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      await new Promise<void>((resolve) => {
        if (this.ws?.readyState === WebSocket.CLOSED) {
          resolve();
        } else {
          this.ws?.addEventListener("close", () => resolve(), { once: true });
        }
      });
    }
    this.cleanup();
  }

  // --------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------

  private splitSentences(text: string): string[] {
    const regex = /[^.!?。！？।؟۔]*[.!?。！？।؟۔]+[\s]*/g;
    const sentences: string[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      const s = match[0].trim();
      if (s) sentences.push(s);
      lastIndex = regex.lastIndex;
    }
    const remaining = text.slice(lastIndex).trim();
    if (remaining) sentences.push(remaining);
    return sentences;
  }

  private handleMessage(rawData: string): void {
    try {
      const data = JSON.parse(rawData) as InworldResponse;

      if ("error" in data) {
        const err = new Error(data.error.message);
        this.emit("error", err);
        this.activeSynthesis = null;
        return;
      }

      // If we have an active synthesis, process its messages
      if (this.activeSynthesis) {
        const { contextId } = this.activeSynthesis;

        if ("result" in data && data.result) {
          const result = data.result;

          if ("audioChunk" in result) {
            const b64 = result.audioChunk.audioContent;
            if (b64) {
              const audioData = Buffer.from(b64, "base64");
              this.emit("audio", audioData); // Uint8Array
            }
          }

          if ("contextClosed" in result) {
            this.emit("done");
            this.activeSynthesis = null;
          }
        }

        if ("done" in data && data.done === true) {
          this.emit("done");
          this.activeSynthesis = null;
        }
      }
    } catch (err) {
      this.emit("error", err);
    }
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws = null;
    }
    if (this.activeSynthesis) {
      this.emit("error", new Error("Connection closed during synthesis"));
      this.activeSynthesis = null;
    }
  }
}

// ----------------------------------------------------------------------
// Inworld – factory for connections
// ----------------------------------------------------------------------

export class Inworld {
  private readonly config: InworldConfig;

  constructor(config: InworldConfig) {
    this.config = config;
  }

  /**
   * Creates and connects a new TTS connection.
   * @returns A connected InworldConnection instance.
   */
  async connect(): Promise<InworldConnection> {
    const connection = new InworldConnection(this.config);
    await connection.connect();
    return connection;
  }
}
