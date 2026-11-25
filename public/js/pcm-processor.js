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
    // At 16kHz, 20ms is 320 samples, 40ms is 640 samples
    this.bufferSize = 640;
    this.buffer = new Int16Array(this.bufferSize);
    this.bufferOffset = 0;

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
    this.bargeInThreshold = 0.12;
    this.bargeInReleaseThreshold = 0.035;
    this.duckHangoverMs = 450; // covers room reverb & audio pipeline latency after playback stops
    this.duckFrameCount = 0;
    this.bargedIn = false;
    this.bargeInAttackCount = 0;
    this.bargeInAttackMs = 110;
    this.bargeInSilenceCount = 0;
    this.bargeInReleaseMs = 300;
    // Adaptive speaker-echo envelope tracked while ducking (never updated by
    // candidate barge-in blocks above the current threshold so real speech can
    // still break through cleanly).
    this.echoFloorRms = 0;
    this.rawPeakRms = 0;

    // Resampling state for phase continuity
    this.resampleOffset = 0.0;

    // In AudioWorkletGlobalScope, sampleRate is available globally.
    const blockDurationMs = (128 / sampleRate) * 1000;
    this.releaseFrames = Math.ceil((sampleRate * this.vadReleaseMs) / 1000 / 128);
    this.duckReleaseFrames = Math.ceil((sampleRate * this.duckHangoverMs) / 1000 / 128);
    this.bargeInAttackFrames = Math.max(1, Math.round((sampleRate * this.bargeInAttackMs) / 1000 / 128));
    this.bargeInReleaseFrames = Math.max(1, Math.ceil((sampleRate * this.bargeInReleaseMs) / 1000 / 128));
    // Sample-rate-independent smoothing factors (~88ms rise / ~265ms fall) so
    // echo-floor tracking behaves identically at 24 kHz and 48 kHz.
    this.echoFloorRiseAlpha = 1 - Math.exp(-blockDurationMs / 88);
    this.echoFloorFallAlpha = 1 - Math.exp(-blockDurationMs / 265);

    this.port.onmessage = (e) => {
      if (e.data && e.data.command === "aiSpeaking") {
        const nextSpeaking = !!e.data.value;
        if (nextSpeaking && !this.aiSpeaking) {
          this.bargedIn = false;
          this.bargeInAttackCount = 0;
          this.bargeInSilenceCount = 0;
        }
        this.aiSpeaking = nextSpeaking;
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
      // fragments. While ducking, we also track an adaptive floor of steady
      // speaker bleed (echoFloorRms) so loud laptop/phone speakers cannot
      // false-trigger barge-in, while sustained close user speech still breaks
      // through cleanly and unlatches promptly once energy drops below
      // bargeInReleaseThreshold for bargeInReleaseMs.
      if (!ducking) {
        this.bargedIn = false;
        this.bargeInAttackCount = 0;
        this.bargeInSilenceCount = 0;
        this.echoFloorRms = 0;
      } else if (this.bargedIn) {
        // Unlatch if speaker echo stays below the higher release floor so
        // residual playback bleed cannot hold the mic open for the whole turn.
        if (rms > this.bargeInReleaseThreshold) {
          this.bargeInSilenceCount = 0;
        } else {
          this.bargeInSilenceCount++;
          if (this.bargeInSilenceCount >= this.bargeInReleaseFrames) {
            this.bargedIn = false;
            this.bargeInSilenceCount = 0;
          }
        }
      } else {
        const effectiveBargeInThreshold = Math.max(
          this.bargeInThreshold,
          this.echoFloorRms * 1.65,
        );
        if (rms > effectiveBargeInThreshold) {
          // Leaky-integrator attack: real human speech dips briefly between
          // syllables/consonants, so decaying smoothly instead of hard-resetting
          // to 0 lets natural corrections break through while still rejecting
          // isolated clicks or speaker spikes.
          this.bargeInAttackCount++;
          if (this.bargeInAttackCount >= this.bargeInAttackFrames) {
            this.bargedIn = true;
            this.bargeInSilenceCount = 0;
          }
        } else {
          if (this.bargeInAttackCount > 0) {
            this.bargeInAttackCount = Math.max(0, this.bargeInAttackCount - 1);
          }
          // Track ambient speaker bleed envelope without letting candidate
          // barge-in speech raise the floor against itself. Capped at 0.14 so
          // effectiveBargeInThreshold never exceeds ~0.23 and conversational
          // interruptions can always break through.
          const clampedBleed = Math.min(rms, 0.14);
          const alpha =
            clampedBleed > this.echoFloorRms
              ? this.echoFloorRiseAlpha
              : this.echoFloorFallAlpha;
          this.echoFloorRms += alpha * (clampedBleed - this.echoFloorRms);
        }
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
        this.buffer[this.bufferOffset++] =
          intVal < 0 ? intVal * 0x8000 : intVal * 0x7FFF;

        // 4. Emit chunk immediately when fixed buffer fills (zero Array.splice)
        if (this.bufferOffset >= this.bufferSize) {
          const int16Array = this.buffer;
          this.buffer = new Int16Array(this.bufferSize);
          this.bufferOffset = 0;

          // Calculate chunk RMS for UI
          let chunkSum = 0;
          for (let i = 0; i < int16Array.length; i++) {
            const sampleFloat = int16Array[i] / 0x8000;
            chunkSum += sampleFloat * sampleFloat;
          }
          // A ducked chunk is all zeros, so fall back to the pre-duck peak —
          // the meter should still show that the mic is picking sound up.
          const chunkRms = muted
            ? this.rawPeakRms
            : Math.sqrt(chunkSum / int16Array.length);
          this.rawPeakRms = 0;

          this.port.postMessage(
            {
              pcm: int16Array.buffer,
              volume: chunkRms,
              isSpeaking: this.isSpeaking, // Send VAD status
              bargedIn: this.bargedIn,
            },
            [int16Array.buffer] // Transfer the buffer to avoid copying
          );
        }

        ratioIdx += ratio;
      }

      this.resampleOffset = ratioIdx - channelData.length;
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
