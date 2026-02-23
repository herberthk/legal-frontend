/**
 * PCM Processor — runs inside the AudioWorklet thread.
 *
 * Buffers incoming Float32 samples, converts them to 16-bit PCM (little-endian),
 * and posts the resulting Int16Array back to the main thread in configurable chunks.
 *
 * Place this file in your Next.js `public/` directory so it can be loaded via
 * `audioContext.audioWorklet.addModule('/pcm-processor.js')`.
 */
class PcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // How many samples to accumulate before flushing (default: 4096 @ 16kHz ≈ 256ms)
    this._chunkSize = options?.processorOptions?.chunkSize ?? 4096;
    this._buffer = [];
    this._count = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0]; // mono channel — Float32Array

    for (let i = 0; i < samples.length; i++) {
      // Clamp to [-1, 1] then scale to Int16 range
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      this._buffer.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
      this._count++;

      if (this._count >= this._chunkSize) {
        this.port.postMessage(new Int16Array(this._buffer));
        this._buffer = [];
        this._count = 0;
      }
    }

    return true; // keep processor alive
  }
}

registerProcessor("pcm-processor", PcmProcessor);
