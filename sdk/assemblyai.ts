/**
 * createAssemblyAISpeechRecognition
 *
 * A drop-in polyfill for the W3C SpeechRecognition API backed by AssemblyAI
 * Universal Streaming v3. Designed to work with `react-speech-recognition`
 * via `SpeechRecognition.applyPolyfill(...)`.
 *
 * Usage:
 *   import { createAssemblyAISpeechRecognition } from '@/lib/assemblyai-polyfill'
 *   import SpeechRecognition from 'react-speech-recognition'
 *
 *   const AssemblyAIRecognition = createAssemblyAISpeechRecognition({
 *     tokenEndpoint: '/api/assemblyai-token',
 *   })
 *   SpeechRecognition.applyPolyfill(AssemblyAIRecognition)
 *
 * Then use react-speech-recognition exactly as normal:
 *   const { transcript, listening, ... } = useSpeechRecognition()
 *   SpeechRecognition.startListening({ continuous: true })
 *
 * Requirements:
 *   - /public/pcm-processor.js  (AudioWorklet processor, already created)
 *   - /api/assemblyai-token     (Next.js route returning { token: string })
 *   - npm install assemblyai
 */

import { StreamingTranscriber } from "assemblyai";

// ─── Types ────────────────────────────────────────────────────────────────────

type StreamingTranscriberOptions = ConstructorParameters<
  typeof StreamingTranscriber
>[0];

export interface AssemblyAIPolyfillOptions {
  /**
   * Next.js API route that returns `{ token: string }`.
   * Default: '/api/assemblyai-token'
   */
  tokenEndpoint?: string;
  /**
   * Mic sample rate. AssemblyAI Universal Streaming supports 16000 and 8000.
   * Default: 16000
   */
  sampleRate?: number;
  /**
   * PCM chunk size (samples). 128ms at 16kHz.
   * Default: 2048
   */
  chunkSize?: number;
}

// Minimal W3C SpeechRecognitionAlternative shape
interface SpeechAlternative {
  transcript: string;
  confidence: number;
}

// Minimal W3C SpeechRecognitionResult shape (array-like + isFinal)
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechAlternative;
  [index: number]: SpeechAlternative;
}

// Minimal W3C SpeechRecognitionResultList shape (array-like)
interface SpeechResultList {
  readonly length: number;
  item(index: number): SpeechResult;
  [index: number]: SpeechResult;
}

// Shape react-speech-recognition reads from onresult events
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechResultList;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a SpeechRecognitionResult-shaped object from a transcript string.
 * react-speech-recognition reads `results[i][0].transcript` and `results[i].isFinal`.
 */
function makeResult(transcript: string, isFinal: boolean): SpeechResult {
  const alternative: SpeechAlternative = {
    transcript,
    confidence: isFinal ? 0.9 : 0.5,
  };
  return {
    isFinal,
    length: 1,
    0: alternative,
    item: () => alternative,
  };
}

/**
 * Build a SpeechRecognitionResultList from an array of SpeechResult objects.
 */
function makeResultList(results: SpeechResult[]): SpeechResultList {
  const list: SpeechResultList = {
    length: results.length,
    item: (i: number) => results[i],
  };
  results.forEach((r, i) => {
    (list as Record<number, SpeechResult>)[i] = r;
  });
  return list;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createAssemblyAISpeechRecognition(
  options: AssemblyAIPolyfillOptions = {},
) {
  const {
    tokenEndpoint = "/api/assemblyai-token",
    sampleRate = 16000,
    chunkSize = 2048,
  } = options;

  /**
   * AssemblyAISpeechRecognition
   *
   * Implements the subset of the W3C SpeechRecognition API that
   * react-speech-recognition actually uses:
   *   - Properties : continuous, interimResults, lang, maxAlternatives
   *   - Methods    : start(), stop(), abort()
   *   - Handlers   : onresult, onerror, onstart, onend,
   *                  onspeechstart, onspeechend, onaudiostart, onaudioend
   *   - Static     : hasBrowserSupport
   */
  class AssemblyAISpeechRecognition {
    // ── W3C properties ───────────────────────────────────────────────────────

    continuous = false;
    interimResults = true; // match browser default — react-speech-recognition expects this
    lang = "en-US";
    maxAlternatives = 1;

    // ── W3C event handlers ───────────────────────────────────────────────────

    onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
    onerror: ((event: { error: string; message: string }) => void) | null =
      null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onspeechstart: (() => void) | null = null;
    onspeechend: (() => void) | null = null;
    onaudiostart: (() => void) | null = null;
    onaudioend: (() => void) | null = null;

    // ── Internal state ───────────────────────────────────────────────────────

    private _transcriber: StreamingTranscriber | null = null;
    private _audioCtx: AudioContext | null = null;
    private _workletNode: AudioWorkletNode | null = null;
    private _sourceNode: MediaStreamAudioSourceNode | null = null;
    private _stream: MediaStream | null = null;
    private _isConnected = false;
    private _isRunning = false;

    // Accumulates final turns so the full transcript grows across turns
    private _finalResults: SpeechResult[] = [];

    // ── Static ───────────────────────────────────────────────────────────────

    static hasBrowserSupport =
      typeof window !== "undefined" &&
      typeof window.AudioContext !== "undefined" &&
      typeof navigator?.mediaDevices?.getUserMedia === "function";

    // ── start() ──────────────────────────────────────────────────────────────

    async start(): Promise<void> {
      if (this._isRunning) return;
      this._isRunning = true;
      this._finalResults = [];

      try {
        // 1. Fetch temporary token
        const res = await fetch(tokenEndpoint);
        if (!res.ok) throw new Error(`Token fetch failed: ${res.statusText}`);
        const { token } = (await res.json()) as { token: string };

        // 2. Connect to AssemblyAI Universal Streaming v3
        const opts: StreamingTranscriberOptions = {
          token,
          sampleRate,
          encoding: "pcm_s16le",
          formatTurns: false, // keep off — formatted text adds latency and can
          // drop events if the formatted version is delayed.
          // Plain text is perfectly readable for a polyfill.
        };

        this._transcriber = new StreamingTranscriber(opts);

        this._transcriber.on("open", () => {
          this.onstart?.();
          this.onspeechstart?.();
        });

        this._transcriber.on(
          "turn",
          (turn: { transcript: string; end_of_turn: boolean }) => {
            if (!turn.transcript) return;

            if (!turn.end_of_turn) {
              // ── Interim result ─────────────────────────────────────────────
              // Only emit if the caller asked for interim results
              if (!this.interimResults) return;

              const interimResult = makeResult(turn.transcript, false);
              const combinedList = makeResultList([
                ...this._finalResults,
                interimResult,
              ]);
              const resultIndex = this._finalResults.length;

              this.onresult?.({ resultIndex, results: combinedList });
            } else {
              // ── Final result ───────────────────────────────────────────────
              // AssemblyAI v3 transcripts are immutable — the end_of_turn event
              // contains the complete, final text for this turn.
              const finalResult = makeResult(turn.transcript, true);
              this._finalResults.push(finalResult);

              const combinedList = makeResultList([...this._finalResults]);
              const resultIndex = this._finalResults.length - 1;

              this.onresult?.({ resultIndex, results: combinedList });

              if (!this.continuous) {
                this.stop();
              }
            }
          },
        );

        this._transcriber.on("error", (err: Error) => {
          this._emitError("network", err.message);
        });

        this._transcriber.on("close", () => {
          this._isConnected = false;
        });

        await this._transcriber.connect();

        // Set _isConnected immediately after connect() resolves — not inside
        // the 'open' event, which in some SDK versions fires synchronously
        // inside connect() before the Promise resolves, meaning the flag would
        // already be true. In other versions it fires after, meaning audio
        // chunks sent before it fires would be silently dropped. Guarding here
        // instead guarantees the flag is true before any audio is sent.
        this._isConnected = true;

        // 3. Open microphone
        this._stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        this.onaudiostart?.();

        // 4. Build AudioContext + AudioWorklet pipeline
        this._audioCtx = new AudioContext({ sampleRate });
        await this._audioCtx.audioWorklet.addModule("/pcm-processor.js");

        this._workletNode = new AudioWorkletNode(
          this._audioCtx,
          "pcm-processor",
          {
            processorOptions: { chunkSize },
          },
        );

        this._sourceNode = this._audioCtx.createMediaStreamSource(this._stream);

        // Silent gain node keeps the worklet alive without playing mic audio back
        const silentGain = this._audioCtx.createGain();
        silentGain.gain.value = 0;
        this._workletNode.connect(silentGain);
        silentGain.connect(this._audioCtx.destination);
        this._sourceNode.connect(this._workletNode);

        this._workletNode.port.onmessage = (
          event: MessageEvent<Int16Array>,
        ) => {
          if (!this._isConnected || !this._transcriber) return;
          if (event.data.length === 0) return;
          try {
            // Pass the Int16Array directly — do NOT use event.data.buffer.
            // The underlying ArrayBuffer may be larger than the valid data range
            // if the typed array is a view into a pooled buffer, which would
            // send trailing zeros and corrupt the PCM stream.
            this._transcriber.sendAudio(event.data);
          } catch {
            // Socket closed between check and send — safe to ignore
          }
        };
      } catch (err) {
        this._isRunning = false;
        const message = err instanceof Error ? err.message : String(err);

        if (
          message.toLowerCase().includes("permission") ||
          message.toLowerCase().includes("notallowed")
        ) {
          this._emitError("not-allowed", message);
        } else if (
          message.toLowerCase().includes("notfound") ||
          message.toLowerCase().includes("no device")
        ) {
          this._emitError("audio-capture", message);
        } else {
          this._emitError("network", message);
        }
      }
    }

    // ── stop() ───────────────────────────────────────────────────────────────

    async stop(): Promise<void> {
      if (!this._isRunning) return;
      this._isRunning = false;

      this._teardownAudio();
      this.onspeechend?.();
      this.onaudioend?.();

      await this._transcriber?.close();
      this._transcriber = null;
      this._isConnected = false;

      this.onend?.();
    }

    // ── abort() ──────────────────────────────────────────────────────────────
    // Same as stop() — react-speech-recognition calls this to cancel mid-session

    abort(): void {
      this.stop();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private _teardownAudio(): void {
      this._workletNode?.port.close();
      this._sourceNode?.disconnect();
      this._workletNode?.disconnect();
      this._workletNode = null;
      this._sourceNode = null;

      this._audioCtx?.close();
      this._audioCtx = null;

      this._stream?.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }

    private _emitError(error: string, message: string): void {
      this.onerror?.({ error, message });
    }
  }

  return AssemblyAISpeechRecognition;
}
