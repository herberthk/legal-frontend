/**
 * AudioWorklet Processor Code
 * Includes VAD (Voice Activity Detection) and Buffering.
 */
export const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    // At 16kHz, 20ms is 320 samples, 40ms is 640 samples
    this.bufferSize = 640; 
    
    // VAD Parameters (Tuned for Effectiveness)
    this.vadThreshold = 0.005; // Lowered for better sensitivity
    this.vadReleaseMs = 800;   // Increased to prevent cutting off short pauses
    this.sampleRateOut = 16000;
    
    this.isSpeaking = false;
    this.silenceFrameCount = 0;
    
    // We expect the browser's context to be 48000Hz or 44100Hz usually
    // This value will be replaced dynamically on init or we just assume sampleRate globally
    // Actually, in AudioWorkletGlobalScope, sampleRate is available globally.
    this.releaseFrames = Math.ceil((sampleRate * this.vadReleaseMs) / 1000 / 128); 
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      
      // 1. Calculate RMS (Volume Energy) using original sample rate
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

      // 3. Resample & Buffer
      // Simple linear interpolation downsampling (maintaining 16kHz)
      const ratio = sampleRate / this.sampleRateOut;
      let ratioIdx = 0;
      
      while (ratioIdx < channelData.length) {
        const i1 = Math.floor(ratioIdx);
        const i2 = Math.min(i1 + 1, channelData.length - 1);
        const fraction = ratioIdx - i1;
        const val = channelData[i1] + fraction * (channelData[i2] - channelData[i1]);
        
        // Convert to Int16
        const intVal = Math.max(-1, Math.min(1, val));
        this.buffer.push(intVal < 0 ? intVal * 0x8000 : intVal * 0x7FFF);
        
        ratioIdx += ratio;
      }

      // 4. Send Chunks when buffer fills
      while (this.buffer.length >= this.bufferSize) {
        const chunk = this.buffer.splice(0, this.bufferSize);
        
        // Calculate chunk RMS for UI
        let chunkSum = 0;
        for (let i = 0; i < chunk.length; i++) {
          const sampleFloat = chunk[i] / 0x8000;
          chunkSum += sampleFloat * sampleFloat;
        }
        const chunkRms = Math.sqrt(chunkSum / chunk.length);

        const int16Array = new Int16Array(chunk);

        this.port.postMessage(
          {
            pcm: int16Array.buffer,
            volume: chunkRms,
            isSpeaking: this.isSpeaking // Send VAD status
          },
          [int16Array.buffer] // Transfer the buffer to avoid copying
        );
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;
