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

export interface SynthesisOptions {
  text: string;
}

export interface AudioChunk {
  data: Buffer;
  sequence?: number;
}

// Internal message types
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
// Inworld TTS Client – Streaming Optimised for Bun
// ----------------------------------------------------------------------

export class Inworld extends EventEmitter {
  private readonly apiKey: string;
  private ws: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private pendingSynthesis: {
    contextId: string;
    onChunk: (chunk: AudioChunk) => void;
    onDone: () => void;
    onError: (err: Error) => void;
  } | null = null;

  private voiceId: VoiceId = "Luna";
  private modelId: ModelId;
  private audioEncoding: "OGG_OPUS" | "PCM" | "MP3" = "OGG_OPUS";
  private sampleRate: number = 24000;
  private bitRate: number = 32000;
  private autoSplitSentences: boolean = true;
  private connectionTimeout: number = 10000;

  constructor(config: InworldConfig) {
    super();
    this.apiKey = config.apiKey;
    this.modelId = config.modelId;
    this.voiceId = config.voiceId ?? "Luna";
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
   * Ensures the WebSocket connection is established.
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
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
          resolve();
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

    return this.connectPromise;
  }

  /**
   * Synthesizes text and returns an async iterable of audio chunks.
   * Chunks are yielded as soon as they arrive from the WebSocket.
   */
  async *synthesize(options: SynthesisOptions): AsyncGenerator<AudioChunk> {
    await this.connect();

    const contextId = randomUUID();
    const queue: AudioChunk[] = [];
    let queueResolve: (() => void) | null = null;
    let synthesisDone = false;
    let synthesisError: Error | null = null;

    // Create context
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
    this.ws!.send(JSON.stringify(createMsg));

    // Set up pending synthesis with callbacks
    this.pendingSynthesis = {
      contextId,
      onChunk: (chunk) => {
        queue.push(chunk);
        if (queueResolve) {
          queueResolve();
          queueResolve = null;
        }
      },
      onDone: () => {
        synthesisDone = true;
        if (queueResolve) {
          queueResolve();
          queueResolve = null;
        }
      },
      onError: (err) => {
        synthesisError = err;
        if (queueResolve) {
          queueResolve();
          queueResolve = null;
        }
      },
    };

    // Send text, optionally split into sentences
    const sentences = this.autoSplitSentences
      ? this.splitSentences(options.text)
      : [options.text];
    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      const sendMsg: SendTextMessage = {
        context_id: contextId,
        send_text: { text: sentence, flush_context: {} },
      };
      this.ws!.send(JSON.stringify(sendMsg));
    }

    // Close context
    const closeMsg: CloseContextMessage = {
      context_id: contextId,
      close_context: {},
    };
    this.ws!.send(JSON.stringify(closeMsg));

    // Stream chunks as they arrive
    try {
      while (!synthesisDone && !synthesisError) {
        if (queue.length === 0) {
          // Wait for a new chunk, completion, or error
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
      if (this.pendingSynthesis?.contextId === contextId) {
        this.pendingSynthesis = null;
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
        if (this.pendingSynthesis) {
          this.pendingSynthesis.onError(err);
          this.pendingSynthesis = null;
        }
        return;
      }

      if (this.pendingSynthesis) {
        const { onChunk, onDone } = this.pendingSynthesis;

        if ("result" in data && data.result) {
          const result = data.result;

          if ("audioChunk" in result) {
            const b64 = result.audioChunk.audioContent;
            if (b64) {
              const audioData = Buffer.from(b64, "base64");
              onChunk({ data: audioData });
            }
          }

          if ("contextClosed" in result) {
            onDone();
            this.pendingSynthesis = null;
          }
        }

        if ("done" in data && data.done === true) {
          onDone();
          this.pendingSynthesis = null;
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
    this.connectPromise = null;
    if (this.pendingSynthesis) {
      this.pendingSynthesis.onError(new Error("Connection closed"));
      this.pendingSynthesis = null;
    }
  }
}
