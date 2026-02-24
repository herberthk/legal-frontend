/**
 * audio-stream-processor.js
 *
 * AudioWorklet processor for low-latency streaming PCM playback.
 *
 * Place in /public so it can be loaded via:
 *   audioContext.audioWorklet.addModule('/audio-stream-processor.js')
 *
 * Architecture:
 *   - Maintains a Float32 ring buffer (circular buffer) in the worklet thread
 *   - Main thread pushes decoded Float32 chunks via port.postMessage (zero-copy transfer)
 *   - process() drains the ring buffer each quantum (128 samples)
 *   - On underrun mid-playback: outputs silence and fires 'underrun'
 *   - On clean drain after playing: fires 'drained' (utterance complete)
 *   - Reports buffer fill level back to main thread every ~100 quanta
 *
 * Messages received (main → worklet):
 *   { type: 'chunk',  samples: Float32Array }  — audio data to enqueue (transferred)
 *   { type: 'flush' }                           — clear buffer (interrupt / new utterance)
 *   { type: 'config', bufferSize?: number }     — optional config before first chunk
 *
 * Messages sent (worklet → main):
 *   { type: 'bufferHealth', filled: number, capacity: number }
 *   { type: 'underrun' }   — buffer ran dry while actively playing
 *   { type: 'drained' }    — buffer emptied cleanly (end of utterance)
 */

const DEFAULT_BUFFER_SAMPLES = 96000; // 2s at 48kHz — good balance of latency vs jitter resilience

class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const capacity =
      options?.processorOptions?.bufferSize ?? DEFAULT_BUFFER_SAMPLES;

    // Ring buffer — single pre-allocated Float32Array
    this._buf = new Float32Array(capacity);
    this._cap = capacity;
    this._writePos = 0;
    this._readPos = 0;
    this._filled = 0;

    // Playback state — gates event reporting so cold-start silence never fires events
    this._isPlaying = false; // true once first chunk is received for an utterance
    this._reportTick = 0;
    this._reportEvery = 100; // ~100 * 128 / 48000 ≈ every 266ms

    this.port.onmessage = ({ data }) => {
      switch (data.type) {
        case "chunk":
          this._enqueue(data.samples);
          break;
        case "flush":
          this._flush();
          break;
        case "config":
          if (data.bufferSize && this._filled === 0) {
            this._buf = new Float32Array(data.bufferSize);
            this._cap = data.bufferSize;
          }
          break;
      }
    };
  }

  // ── Ring buffer ops ────────────────────────────────────────────────────────

  _enqueue(samples) {
    const len = samples.length;
    // If incoming chunk is larger than capacity, keep only the tail
    const srcOffset = len > this._cap ? len - this._cap : 0;
    const count = len - srcOffset;

    for (let i = 0; i < count; i++) {
      this._buf[this._writePos] = samples[srcOffset + i];
      this._writePos = (this._writePos + 1) % this._cap;

      if (this._filled < this._cap) {
        this._filled++;
      } else {
        // Overflow — advance read pointer, drop oldest sample
        this._readPos = (this._readPos + 1) % this._cap;
      }
    }

    this._isPlaying = true; // receiving data = we are now in an active utterance
  }

  _flush() {
    this._writePos = 0;
    this._readPos = 0;
    this._filled = 0;
    this._isPlaying = false;
  }

  _readSample() {
    if (this._filled === 0) return 0;
    const s = this._buf[this._readPos];
    this._readPos = (this._readPos + 1) % this._cap;
    this._filled--;
    return s;
  }

  // ── Audio process callback (runs every 128 samples) ───────────────────────

  process(_inputs, outputs) {
    const channel = outputs[0]?.[0];
    if (!channel) return true;

    const quantum = channel.length; // always 128
    const filledBefore = this._filled;

    for (let i = 0; i < quantum; i++) {
      channel[i] = this._readSample();
    }

    // Event reporting — only while actively playing, prevents spurious events
    // during idle silence between utterances.
    if (this._isPlaying) {
      if (filledBefore > 0 && this._filled === 0) {
        // Buffer just went empty — clean drain (utterance finished)
        this._isPlaying = false;
        this.port.postMessage({ type: "drained" });
      } else if (filledBefore === 0 && this._filled === 0) {
        // Was already empty but still "playing" — true underrun mid-stream
        this._isPlaying = false;
        this.port.postMessage({ type: "underrun" });
      }
    }

    // Throttled health report — skip when buffer is empty (no UI value in reporting zeros)
    if (this._filled > 0) {
      this._reportTick++;
      if (this._reportTick >= this._reportEvery) {
        this._reportTick = 0;
        this.port.postMessage({
          type: "bufferHealth",
          filled: this._filled,
          capacity: this._cap,
        });
      }
    }

    return true; // keep processor alive indefinitely
  }
}

registerProcessor("audio-stream-processor", AudioStreamProcessor);
