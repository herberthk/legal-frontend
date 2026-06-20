/**
 * Creates a broadcast-quality audio processing chain for Gemini voice output.
 * It applies a high-pass filter, presence EQ, and a hard limiter to ensure
 * clear, loud, and unclipped speech.
 * 
 * Chain: Input → HighPass → PresenceEQ → Gain → Limiter → Trim → Destination
 */
export function createGeminiAudioChain(ctx: AudioContext) {
  // 1. High-pass filter — cuts sub-80Hz rumble before anything amplifies it
  const highPass = ctx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 80;
  highPass.Q.value = 0.7071; // Butterworth (maximally flat passband)

  // 2. Presence EQ — lifts the 3kHz consonant band for speech clarity
  const presenceEQ = ctx.createBiquadFilter();
  presenceEQ.type = "peaking";
  presenceEQ.frequency.value = 3000;
  presenceEQ.Q.value = 1.2; // moderate width (~1 octave)
  presenceEQ.gain.value = 4; // +4dB lift in the presence band

  // 3. Master gain — the node that toggleAudioMute ramps between 0 and 1.4
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1.4;

  // 4. Limiter — brick-wall ceiling at -4dB so the gain boost never clips
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  limiter.knee.value = 0;

  // 5. Output trim — final -0.5dB safety margin against inter-sample peaks
  //    -0.5dB ≈ 10^(-0.5/20) ≈ 0.9441
  const outputTrim = ctx.createGain();
  outputTrim.gain.value = 0.9441;

  // Wire the chain: highPass → presenceEQ → gain → limiter → trim → destination
  highPass.connect(presenceEQ);
  presenceEQ.connect(gainNode);
  gainNode.connect(limiter);
  limiter.connect(outputTrim);
  outputTrim.connect(ctx.destination);

  return {
    highPass,
    presenceEQ,
    masterGain: gainNode,
    limiter,
    outputTrim,
  };
}
