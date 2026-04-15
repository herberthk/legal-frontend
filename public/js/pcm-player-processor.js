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
 *                             active → empty (debounced ~150 ms to ride out
 *                             inter-chunk network jitter).
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Ring buffer — 24 kHz × 180 s = 4 320 000 samples max
    this.bufferSize = 24000 * 180;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;

    // Buffer-empty detection with debounce
    this.wasActive = false;
    // ~150 ms at 24 kHz / 128-sample blocks ≈ 28 consecutive empty blocks
    this.emptyThreshold = 28;
    this.emptyCount = 0;

    // Handle incoming messages from main thread
    this.port.onmessage = (event) => {
      // Reset the buffer when 'endOfAudio' message received
      if (event.data && event.data.command === "endOfAudio") {
        this.readIndex = this.writeIndex;
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
        // Play from buffer
        const sample = this.buffer[this.readIndex];
        output[0][frame] = sample;
        if (output.length > 1) {
          output[1][frame] = sample;
        }
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      } else {
        // Buffer empty — output silence to avoid DC offset clicks
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
