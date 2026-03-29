/**
 * AudioWorklet Processor Code
 * Includes VAD (Voice Activity Detection) and Buffering.
 */
export const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 2048; // Buffer ~128ms at 16k
    
    // VAD Parameters (Tuned for Effectiveness)
    this.vadThreshold = 0.005; // Lowered for better sensitivity (was 0.008)
    this.vadReleaseMs = 800;   // Increased to prevent cutting off short pauses (was 600)
    this.sampleRate = 16000;   // Assumed processing rate
    
    this.isSpeaking = false;
    this.silenceFrameCount = 0;
    // Calculate frames to wait: (SampleRate * ms) / 1000 / 128_samples_per_render_quantum
    this.releaseFrames = Math.ceil((this.sampleRate * this.vadReleaseMs) / 1000 / 128); 
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      
      // 1. Calculate RMS (Volume Energy)
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sum / channelData.length);

      // 2. VAD Logic
      if (rms > this.vadThreshold) {
        this.isSpeaking = true;
        this.silenceFrameCount = 0;
      } else {
        if (this.isSpeaking) {
          this.silenceFrameCount++;
          if (this.silenceFrameCount > this.releaseFrames) {
            this.isSpeaking = false;
          }
        }
      }

      // 3. Buffer Data (Always buffer to calculate volume, but gate sending)
      for (let i = 0; i < channelData.length; i++) {
        this.buffer.push(channelData[i]);
      }

      // 4. Send Chunk
      if (this.buffer.length >= this.bufferSize) {
        const chunk = new Float32Array(this.buffer);
        
        // Calculate chunk RMS for UI
        let chunkSum = 0;
        for (let i = 0; i < chunk.length; i++) {
          chunkSum += chunk[i] * chunk[i];
        }
        const chunkRms = Math.sqrt(chunkSum / chunk.length);

        this.port.postMessage({
          pcm: chunk,
          volume: chunkRms,
          isSpeaking: this.isSpeaking // Send VAD status
        });
        
        this.buffer = [];
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;
