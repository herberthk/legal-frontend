/**
 * Ring-buffer AudioWorklet for seamless PCM playback.
 *
 * Incoming Int16 PCM chunks are enqueued into a continuous ring buffer.
 * The process() method reads from the buffer at the AudioContext sample rate,
 * producing gapless audio with zero chunk-boundary artifacts (no clicks).
 *
 * Commands:
 *   { command: "endOfAudio" } — flush / clear the buffer immediately.
 *
 * Outgoing messages:
 *   { type: "bufferEmpty" } — sent once when the buffer transitions from
 *                             active → empty (debounced ~250 ms to ride out
 *                             inter-chunk network jitter).
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Ring buffer — 24 kHz × 60 s = 1 440 000 samples (~5.7 MB)
    this.inputSampleRate = 24000;
    this.bufferSize = this.inputSampleRate * 60;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    // Fractional read offset for resampling 24 kHz input to AudioContext sampleRate
    this.rateRatio = this.inputSampleRate / sampleRate;
    this.readFrac = 0;

    // Buffer-empty detection with debounce (~250 ms at active AudioContext rate)
    this.wasActive = false;
    this.emptyThreshold = Math.ceil((sampleRate * 0.25) / 128);
    this.emptyCount = 0;

    // Handle incoming messages from main thread
    this.port.onmessage = (event) => {
      // Reset the buffer when 'endOfAudio' message received
      if (event.data && event.data.command === "endOfAudio") {
        this.readIndex = this.writeIndex;
        this.readFrac = 0;
        this.wasActive = false;
        this.emptyCount = 0;
        return;
      }

      // Incoming data is an ArrayBuffer of Int16 PCM
      const int16Samples = new Int16Array(event.data);
      this._enqueue(int16Samples);
    };
  }

  // Push incoming Int16 data into our ring buffer.
  _enqueue(int16Samples) {
    for (let i = 0; i < int16Samples.length; i++) {
      // Convert 16-bit integer to float in [-1, 1]
      const floatVal = int16Samples[i] / 32768;

      // Store in ring buffer (mono)
      this.buffer[this.writeIndex] = floatVal;
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;

      // Overflow handling — overwrite oldest samples
      if (this.writeIndex === this.readIndex) {
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      }
    }
  }

  // Called ~128 samples at a time by the audio rendering thread.
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const framesPerBlock = output[0].length;

    for (let frame = 0; frame < framesPerBlock; frame++) {
      if (this.readIndex !== this.writeIndex) {
        let sample;
        if (this.rateRatio === 1) {
          // Fast path: AudioContext runs natively at 24 kHz
          sample = this.buffer[this.readIndex];
          this.readIndex = (this.readIndex + 1) % this.bufferSize;
        } else {
          // Linear interpolation resampling from 24 kHz to context sampleRate
          const s0 = this.buffer[this.readIndex];
          const nextIdx = (this.readIndex + 1) % this.bufferSize;
          const s1 = nextIdx !== this.writeIndex ? this.buffer[nextIdx] : s0;
          sample = s0 + (s1 - s0) * this.readFrac;

          this.readFrac += this.rateRatio;
          while (this.readFrac >= 1 && this.readIndex !== this.writeIndex) {
            this.readIndex = (this.readIndex + 1) % this.bufferSize;
            this.readFrac -= 1;
          }
          if (this.readIndex === this.writeIndex) {
            this.readFrac = 0;
          }
        }
        output[0][frame] = sample;
        if (output.length > 1) {
          output[1][frame] = sample;
        }
      } else {
        // Buffer empty — output silence to avoid DC offset clicks
        this.readFrac = 0;
        output[0][frame] = 0;
        if (output.length > 1) {
          output[1][frame] = 0;
        }
      }
    }

    // Track buffer-empty transitions with debounce
    const isEmpty = this.readIndex === this.writeIndex;
    if (isEmpty) {
      this.emptyCount++;
      if (this.wasActive && this.emptyCount > this.emptyThreshold) {
        this.port.postMessage({ type: "bufferEmpty" });
        this.wasActive = false;
      }
    } else {
      this.emptyCount = 0;
      this.wasActive = true;
    }

    return true;
  }
}

registerProcessor("pcm-player-processor", PCMPlayerProcessor);
