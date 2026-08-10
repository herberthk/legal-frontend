/**
 * AudioWorklet Processor for PCM Recording
 * Includes VAD (Voice Activity Detection) and Resampling.
 *
 * This file MUST be loaded from a real URL (not a data: URI)
 * because Firefox does not support data: URIs for audioWorklet.addModule().
 */
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

    // Half-duplex ducking. Browser AEC only cancels what it treats as the
    // render reference; Firefox does not feed AudioContext output into that
    // reference at all, so the AI's own voice comes back through the mic
    // uncancelled and Gemini answers itself. While the AI is audible we
    // transmit digital silence unless the incoming level clears a much
    // higher bar than the normal VAD, which is what lets a real interruption
    // through. Silence is sent rather than nothing so the server-side VAD
    // keeps seeing a continuous stream and can still detect end-of-turn.
    this.aiSpeaking = false;
    this.bargeInThreshold = 0.06;
    this.duckHangoverMs = 250; // covers room reverb after playback stops
    this.duckFrameCount = 0;
    this.bargedIn = false;
    this.bargeInAttackCount = 0;
    this.bargeInAttackMs = 40;
    this.rawPeakRms = 0;

    // Resampling state for phase continuity
    this.resampleOffset = 0.0;

    // In AudioWorkletGlobalScope, sampleRate is available globally.
    this.releaseFrames = Math.ceil((sampleRate * this.vadReleaseMs) / 1000 / 128);
    this.duckReleaseFrames = Math.ceil((sampleRate * this.duckHangoverMs) / 1000 / 128);
    this.bargeInAttackFrames = Math.max(1, Math.round((sampleRate * this.bargeInAttackMs) / 1000 / 128));

    this.port.onmessage = (e) => {
      if (e.data && e.data.command === "aiSpeaking") {
        this.aiSpeaking = !!e.data.value;
        if (this.aiSpeaking) this.duckFrameCount = this.duckReleaseFrames;
      }
    };
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

      // Report the true mic level to the UI even while ducked, so the meter
      // keeps showing that the microphone is live.
      if (rms > this.rawPeakRms) this.rawPeakRms = rms;

      // 1b. Duck decision — held open for the hangover window after the AI
      // stops so the tail of the echo doesn't slip through.
      if (this.aiSpeaking) {
        this.duckFrameCount = this.duckReleaseFrames;
      } else if (this.duckFrameCount > 0) {
        this.duckFrameCount--;
      }
      const ducking = this.duckFrameCount > 0;

      // Barge-in latches. Speech dips below the threshold between syllables,
      // so testing the level per block would chop a real interruption into
      // fragments. Once the user breaks through, the gate stays open until
      // the normal VAD release says they've actually stopped — which is also
      // what stops a single cough from holding it open for the whole turn.
      if (!ducking) {
        this.bargedIn = false;
        this.bargeInAttackCount = 0;
      } else if (rms > this.bargeInThreshold) {
        // Sustained energy, not a single loud block — a plosive in the AI's
        // own playback can spike past the threshold for one block, and 40ms
        // of lead-in is imperceptible on a genuine interruption.
        this.bargeInAttackCount++;
        if (this.bargeInAttackCount >= this.bargeInAttackFrames) {
          this.bargedIn = true;
        }
      } else {
        this.bargeInAttackCount = 0;
      }
      const muted = ducking && !this.bargedIn;

      // 2. VAD Logic
      if (muted) {
        // Suppressed audio must not register as user speech, otherwise the
        // recorder captures the echo and the UI claims to be listening.
        this.isSpeaking = false;
        this.silenceFrameCount = 0;
      } else if (rms > this.vadThreshold) {
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

      // Release the latch once the interruption is over, so ducking resumes
      // if the AI is still talking.
      if (this.bargedIn && !this.isSpeaking) this.bargedIn = false;

      // 3. Resample & Buffer
      // Stateful linear interpolation downsampling (maintaining 16kHz)
      const ratio = sampleRate / this.sampleRateOut;
      let ratioIdx = this.resampleOffset;

      while (ratioIdx < channelData.length) {
        const i1 = Math.floor(ratioIdx);
        const fraction = ratioIdx - i1;
        const s1 = channelData[i1];
        const s2 = (i1 + 1 < channelData.length) ? channelData[i1 + 1] : s1;

        const val = s1 + fraction * (s2 - s1);

        // Convert to Int16 — zeroed while ducked so the echo never reaches
        // Gemini, while the stream itself stays continuous.
        const intVal = muted ? 0 : Math.max(-1, Math.min(1, val));
        this.buffer.push(intVal < 0 ? intVal * 0x8000 : intVal * 0x7FFF);

        ratioIdx += ratio;
      }

      this.resampleOffset = ratioIdx - channelData.length;

      // 4. Send Chunks when buffer fills
      while (this.buffer.length >= this.bufferSize) {
        const chunk = this.buffer.splice(0, this.bufferSize);

        // Calculate chunk RMS for UI
        let chunkSum = 0;
        for (let i = 0; i < chunk.length; i++) {
          const sampleFloat = chunk[i] / 0x8000;
          chunkSum += sampleFloat * sampleFloat;
        }
        // A ducked chunk is all zeros, so fall back to the pre-duck peak —
        // the meter should still show that the mic is picking sound up.
        const chunkRms = muted
          ? this.rawPeakRms
          : Math.sqrt(chunkSum / chunk.length);
        this.rawPeakRms = 0;

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
