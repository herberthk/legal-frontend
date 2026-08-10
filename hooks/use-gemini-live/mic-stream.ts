/**
 * Shared microphone stream holder.
 *
 * Firefox only persists mic permission when the user ticks "Remember this
 * decision". Otherwise the grant lasts as long as a stream stays live — so
 * acquiring a stream, stopping it, and calling getUserMedia again (which is
 * what a pre-flight permission check does) raises a SECOND prompt. Chrome
 * persists the grant per-origin and never re-prompts, which is why this only
 * ever bit Firefox.
 *
 * The fix is to acquire once and reuse. MicrophoneSoftPrompt parks the stream
 * it obtained here instead of stopping it; the voice session then claims that
 * same stream rather than requesting a new one.
 */

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true,
  },
};

let parkedStream: MediaStream | null = null;

/** True when the stream still has a usable (non-ended) audio track. */
const isUsable = (stream: MediaStream | null): stream is MediaStream =>
  !!stream && stream.getAudioTracks().some((t) => t.readyState === "live");

/**
 * Acquires a mic stream with the constraints the session needs. Both the
 * permission prompt and the session request through here, so a parked stream
 * is always session-grade. echoCancellation matters most: without it the AI's
 * own voice feeds back through the mic and it interrupts itself.
 */
export function requestMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
}

/**
 * Hand a freshly-granted stream to the holder for the session to pick up.
 * Tracks are muted while parked so no audio is captured before the call
 * starts; claimMicStream re-enables them.
 */
export function parkMicStream(stream: MediaStream) {
  if (parkedStream && parkedStream !== stream) releaseMicStream();
  stream.getAudioTracks().forEach((track) => {
    track.enabled = false;
  });
  parkedStream = stream;
}

/**
 * Returns the parked stream if one is still live, otherwise requests a new
 * one. Either way the caller owns the result and is responsible for stopping
 * its tracks when the session ends.
 */
export function claimMicStream(): Promise<MediaStream> {
  if (isUsable(parkedStream)) {
    const stream = parkedStream;
    parkedStream = null;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    // No applyConstraints() here on purpose. Both call sites acquire through
    // requestMicStream(), so a parked stream already carries the right
    // constraints — and awaiting applyConstraints() in Firefox can leave the
    // promise unsettled, which stalls the whole connect path on a call that
    // was only ever a safety net.
    return Promise.resolve(stream);
  }

  parkedStream = null;
  return requestMicStream();
}

/** Stops and clears the parked stream (e.g. on unmount before a call starts). */
export function releaseMicStream() {
  parkedStream?.getTracks().forEach((track) => track.stop());
  parkedStream = null;
}

/**
 * Best-effort native sample rate for a mic stream, used only when a
 * fixed-rate AudioContext refuses the stream. Prefers the track's own
 * reported rate and falls back to a short-lived default-rate context, which
 * always reports the hardware rate.
 */
export function detectNativeSampleRate(stream: MediaStream): number {
  const trackRate = stream.getAudioTracks()[0]?.getSettings?.().sampleRate;
  if (trackRate) return trackRate;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  const probe = new Ctor();
  const rate = probe.sampleRate;
  probe.close().catch(() => {});
  return rate;
}
