// Import types from the types directory

import type { InworldConfig, AudioCallback } from "./types";

/* -------------------------------------------------- */
/*                INWORLD CLASS                       */
/* -------------------------------------------------- */

/**
 * Bun-native persistent low-latency Inworld TTS client.
 *
 * Responsibilities:
 * - Maintain persistent WebSocket
 * - Handle context lifecycle
 * - Stream text safely
 * - Emit decoded audio chunks
 * - Auto reconnect
 *
 * No timing logic.
 * No playback logic.
 * Pure transport abstraction.
 */
export class Inworld {
  private ws?: WebSocket;
  private readonly url =
    "wss://api.inworld.ai/tts/v1/voice:streamBidirectional";

  private readonly config: Required<InworldConfig>;
  private contextId = crypto.randomUUID();
  private contextReady = false;
  private reconnectAttempts = 0;
  private buffer = "";
  private audioHandler?: AudioCallback;
  private connecting: Promise<void> | null = null;

  constructor(config: InworldConfig) {
    if (!config.apiKey) {
      throw new Error("INWORLD API key is required.");
    }

    this.config = {
      modelId: config.modelId ?? "inworld-tts-1.5-mini",
      encoding: config.encoding ?? "LINEAR16",
      sampleRate: config.sampleRate ?? 48000,
      bitRate: config.bitRate ?? 128000,
      autoReconnect: config.autoReconnect ?? true,
      debug: config.debug ?? false,
      ...config,
    };
  }

  get debug() {
    return this.config.debug;
  }

  /**
   * Clears internal buffers and resets the context ID.
   * Call this before starting a new turn to ensure no "leaked" audio from previous turns.
   */
  async resetContext(): Promise<void> {
    if (this.config.debug) console.log("[Inworld] 🔄 Resetting context...");

    // 1. Explicitly close previous context if open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.config.debug)
        console.log(`[Inworld] 🔌 Closing old context: ${this.contextId}`);
      this.ws.send(
        JSON.stringify({
          context_id: this.contextId,
          close_context: {},
        }),
      );
    }

    this.buffer = "";
    this.contextId = crypto.randomUUID();
    this.contextReady = false;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      await this.createContext();
    }
  }

  /* -------------------------------------------------- */
  /*                PUBLIC API                          */
  /* -------------------------------------------------- */

  /**
   * Establish persistent connection.
   * Safe to call multiple times.
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.connecting) return this.connecting;

    this.connecting = this.createConnectionWithRetry();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async createConnectionWithRetry(attempts = 3): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      try {
        await this.createConnection();
        this.reconnectAttempts = 0; // Reset on success
        return;
      } catch (err) {
        const isLast = i === attempts - 1;
        const delay = Math.min(1000 * 2 ** i, 5000);

        console.error(
          `[Inworld] Connection attempt ${i + 1}/${attempts} failed:`,
          err instanceof Error ? err.message : String(err),
        );

        if (isLast) throw err;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  /**
   * Register audio chunk listener.
   */
  onAudio(callback: AudioCallback) {
    this.audioHandler = callback;
  }

  /**
   * Push streaming text (LLM tokens supported).
   * Flushes on sentence boundary.
   */
  push(chunk: string) {
    this.ensureConnected();
    this.buffer += chunk;

    const sentences = this.extractSentences(this.buffer);
    if (!sentences.length) return;

    for (const sentence of sentences) {
      this.sendText(sentence);
    }

    const last = sentences.at(-1)!;
    const index = this.buffer.lastIndexOf(last);
    this.buffer = this.buffer.slice(index + last.length);
  }

  /**
   * Flush remaining text.
   */
  async flush() {
    if (!this.buffer.trim()) return;

    this.sendText(this.buffer);
    this.buffer = "";
  }

  /**
   * Close current context.
   * Connection remains open for reuse.
   */
  async close(): Promise<void> {
    if (!this.ws) return;

    this.ws.send(
      JSON.stringify({
        context_id: this.contextId,
        close_context: {},
      }),
    );

    this.contextReady = false;
  }

  /**
   * Fully destroy connection.
   */
  destroy() {
    this.ws?.close();
    this.ws = undefined;
    this.contextReady = false;
  }

  /* -------------------------------------------------- */
  /*                INTERNALS                          */
  /* -------------------------------------------------- */

  private async createConnection(): Promise<void> {
    this.ws = new WebSocket(this.url, {
      //@ts-ignore
      headers: {
        Authorization: `Basic ${this.config.apiKey}`,
      },
    });

    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => {
        if (this.config.debug) console.log("[Inworld] WebSocket opened");
        resolve();
      };
      this.ws!.onerror = (event) => {
        const msg =
          "message" in event ? event.message : "Unknown WebSocket error";
        reject(new Error(`Inworld connection failed: ${msg}`));
      };

      // Safety timeout for the handshake itself
      setTimeout(() => reject(new Error("Inworld connection timeout")), 10000);
    });

    this.attachListeners();
    await this.createContext();
  }

  private attachListeners() {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const resContextId = this.extractContextId(data);

      if (data.error) {
        if (this.config.debug) console.error("[Inworld] Error:", data.error);
        return;
      }

      // Drop messages from stale/aborted contexts to prevent race conditions
      if (!resContextId || resContextId !== this.contextId) {
        if (this.config.debug) {
          console.log(
            `[Inworld] Dropping message. Detected ID: '${resContextId || "unknown"}' | Expected ID: '${this.contextId}'`,
          );
        }
        return;
      }

      const result = data.result;
      if (!result) return;

      if (result.contextCreated !== undefined) {
        if (this.config.debug)
          console.log(`[Inworld] Context ready: ${resContextId}`);
        this.contextReady = true;
        this.reconnectAttempts = 0;
        return;
      }

      if (result.audioChunk?.audioContent) {
        const buffer = Buffer.from(result.audioChunk.audioContent, "base64");
        this.audioHandler?.(buffer);
      }

      if (result.contextClosed !== undefined) {
        if (this.config.debug)
          console.log(`[Inworld] Context closed: ${resContextId}`);
        this.contextReady = false;
      }
    };

    this.ws.onclose = () => {
      this.contextReady = false;

      if (this.config.autoReconnect) {
        this.reconnect();
      }
    };
  }

  private async createContext(): Promise<void> {
    this.ws!.send(
      JSON.stringify({
        context_id: this.contextId,
        create: {
          voice_id: this.config.voiceId,
          model_id: this.config.modelId,
          audio_config: {
            audio_encoding: this.config.encoding,
            sample_rate_hertz: this.config.sampleRate,
            bit_rate: this.config.bitRate,
          },
        },
      }),
    );

    await this.waitForContext();
  }

  private sendText(text: string) {
    this.ws!.send(
      JSON.stringify({
        context_id: this.contextId,
        send_text: {
          text,
          flush_context: {},
        },
      }),
    );
  }

  private ensureConnected() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Inworld is not connected.");
    }
  }

  private waitForContext(): Promise<void> {
    return new Promise((resolve) => {
      // 2s timeout failsafe to prevent server-side hangs
      const timeout = setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 2000);

      const interval = setInterval(() => {
        if (this.contextReady) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });
  }

  private async reconnect() {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
    this.reconnectAttempts++;

    await new Promise((r) => setTimeout(r, delay));
    await this.createConnection();
  }

  /**
   * Fast streaming-safe sentence splitter.
   */
  private extractSentences(text: string): string[] {
    const matches = text.match(/[^.!?]+[.!?]+/g);
    return matches?.map((s) => s.trim()) ?? [];
  }

  private extractContextId(data: Record<string, unknown>): string | undefined {
    // Inworld can return context ID at various levels depending on the message type
    //@ts-ignore
    return data.result?.contextId as string;
  }
}
