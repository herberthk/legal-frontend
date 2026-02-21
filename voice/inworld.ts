// inworld.ts

/* -------------------------------------------------- */
/*                     ENUMS                          */
/* -------------------------------------------------- */

export type VoiceId =
  | "Blake"
  | "Luna"
  | "Dennis"
  | "Sarah"
  | "Hana"
  | "Mark"
  | "Hades"
  | "Theodore"
  | "Abby"
  | "Alex"
  | "Amina"
  | "Ashley"
  | "Brian"
  | "Callum"
  | "Carter"
  | "Celeste"
  | "Chloe"
  | "Claire"
  | "Craig"
  | "Darlene"
  | "Deborah"
  | "Derek"
  | "Edward"
  | "Elliot"
  | "Ethan"
  | "Evan"
  | "Evelyn"
  | "Gareth"
  | "Graham"
  | "Grant"
  | "Hamish"
  | "Hank"
  | "Jake"
  | "James"
  | "Jason"
  | "Jessica"
  | "Kayla"
  | "Kelsey"
  | "Lauren"
  | "Liam"
  | "Loretta"
  | "Malcolm"
  | "Marlene"
  | "Miranda"
  | "Mortimer"
  | "Nate"
  | "Oliver"
  | "Pippa"
  | "Pixie"
  | "Ronald"
  | "Rupert"
  | "Serena"
  | "Simon"
  | "Snik"
  | "Tessa"
  | "Timothy"
  | "Tyler"
  | "Veronica"
  | "Victor"
  | "Victoria"
  | "Vinny"
  | "Wendy";

export type ModelId = "inworld-tts-1.5-mini" | "inworld-tts-1.5-max";

export type AudioEncoding =
  | "OGG_OPUS"
  | "MP3"
  | "LINEAR16"
  | "ALAW"
  | "MULAW"
  | "FLAC";

/* -------------------------------------------------- */
/*                     TYPES                          */
/* -------------------------------------------------- */

export interface InworldConfig {
  apiKey: string;
  voiceId: VoiceId;
  modelId?: ModelId;
  encoding?: AudioEncoding;
  sampleRate?: number;
  bitRate?: number;
  autoReconnect?: boolean;
  debug?: boolean;
}

type AudioCallback = (audioChunk: Buffer) => void;

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

  /* -------------------------------------------------- */
  /*                PUBLIC API                          */
  /* -------------------------------------------------- */

  /**
   * Establish persistent connection.
   * Safe to call multiple times.
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    await this.createConnection();
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
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = (err) => reject(err);
    });

    this.attachListeners();
    await this.createContext();
  }

  private attachListeners() {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.error) {
        if (this.config.debug) console.error(data.error);
        return;
      }

      const result = data.result;
      if (!result) return;

      if (result.contextCreated !== undefined) {
        this.contextReady = true;
        this.reconnectAttempts = 0;
        return;
      }

      if (result.audioChunk?.audioContent) {
        const buffer = Buffer.from(result.audioChunk.audioContent, "base64");

        this.audioHandler?.(buffer);
      }

      if (result.contextClosed !== undefined) {
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
      const interval = setInterval(() => {
        if (this.contextReady) {
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
}
