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
 *   - Main thread pushes decoded Float32 chunks via port.postMessage
 *   - process() drains the ring buffer each quantum (128 samples)
 *   - On underrun: outputs silence instead of repeating/glitching
 *   - Reports buffer fill level back to main thread every ~200ms
 *
 * Messages received (main → worklet):
 *   { type: 'chunk',   samples: Float32Array }  — audio data to enqueue
 *   { type: 'flush' }                           — clear buffer immediately (new utterance)
 *   { type: 'config',  bufferSize?: number }    — optional config (before first chunk)
 *
 * Messages sent (worklet → main):
 *   { type: 'bufferHealth', filled: number, capacity: number }
 *   { type: 'underrun' }   — fired when buffer runs dry mid-playback
 *   { type: 'drained' }    — fired when buffer empties after having data (utterance done)
 */

const DEFAULT_BUFFER_SAMPLES = 48000; // 1s at 48kHz

class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const capacity =
      options?.processorOptions?.bufferSize ?? DEFAULT_BUFFER_SAMPLES;

    // Ring buffer — a single pre-allocated Float32Array
    this._buffer = new Float32Array(capacity);
    this._capacity = capacity;
    this._writePos = 0;
    this._readPos = 0;
    this._filled = 0; // number of samples currently in the buffer

    this._hadData = false; // track whether we've ever received a chunk this utterance
    this._reportInterval = 0; // counter for throttling bufferHealth reports
    this._reportEvery = 200; // report every ~200 quanta (≈ 200 * 128 / sampleRate seconds)

    this.port.onmessage = (event) => {
      const { type } = event.data;

      if (type === "chunk") {
        this._enqueue(event.data.samples);
      } else if (type === "flush") {
        this._flush();
      } else if (type === "config" && event.data.bufferSize) {
        // Re-allocate if a custom size is requested before first chunk
        if (this._filled === 0) {
          this._buffer = new Float32Array(event.data.bufferSize);
          this._capacity = event.data.bufferSize;
        }
      }
    };
  }

  /** Write samples into the ring buffer, dropping oldest data on overflow */
  _enqueue(samples) {
    const len = samples.length;

    // If incoming chunk is larger than capacity, only keep the tail
    const srcOffset = len > this._capacity ? len - this._capacity : 0;
    const count = len - srcOffset;

    for (let i = 0; i < count; i++) {
      this._buffer[this._writePos] = samples[srcOffset + i];
      this._writePos = (this._writePos + 1) % this._capacity;

      if (this._filled < this._capacity) {
        this._filled++;
      } else {
        // Overflow — advance read pointer to discard oldest sample
        this._readPos = (this._readPos + 1) % this._capacity;
      }
    }

    this._hadData = true;
  }

  /** Clear all buffered audio (call at start of a new utterance) */
  _flush() {
    this._readPos = 0;
    this._writePos = 0;
    this._filled = 0;
    this._hadData = false;
  }

  /** Read one sample from the ring buffer (returns 0 on underrun) */
  _readSample() {
    if (this._filled === 0) return 0;

    const sample = this._buffer[this._readPos];
    this._readPos = (this._readPos + 1) % this._capacity;
    this._filled--;
    return sample;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const channel = output[0];

    if (!channel) return true;

    const quantum = channel.length; // always 128
    const wasNonEmpty = this._filled > 0;

    for (let i = 0; i < quantum; i++) {
      channel[i] = this._readSample();
    }

    // Detect underrun: had data, now empty
    if (wasNonEmpty && this._filled === 0) {
      if (this._hadData) {
        this.port.postMessage({ type: "drained" });
        this._hadData = false;
      } else {
        this.port.postMessage({ type: "underrun" });
      }
    }

    // Throttled buffer health report
    this._reportInterval++;
    if (this._reportInterval >= this._reportEvery) {
      this._reportInterval = 0;
      this.port.postMessage({
        type: "bufferHealth",
        filled: this._filled,
        capacity: this._capacity,
      });
    }

    return true; // keep processor alive
  }
}

registerProcessor("audio-stream-processor", AudioStreamProcessor);
