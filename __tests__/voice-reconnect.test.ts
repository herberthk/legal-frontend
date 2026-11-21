import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGeminiLive } from "@/hooks/use-gemini-live";

const { connect } = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { live = { connect }; }, Modality: { AUDIO: "AUDIO" },
}));
vi.mock("@zakj/no-sleep", () => ({ default: class { enable() {} disable() {} } }));
vi.mock("@/hooks/use-gemini-live/use-ephemeral-token", () => ({
  useEphemeralToken: () => ({
    getEphemeralToken: async () => "local-token",
    prefetchToken: vi.fn(),
    clearCachedToken: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-gemini-live/use-firebase-sync", () => ({
  useFirebaseSync: () => ({ syncSessionToBuffer: vi.fn(), heartbeatBuffer: vi.fn() }),
}));
vi.mock("@/hooks/use-gemini-live/audio-setup", () => ({ createGeminiAudioChain: () => ({}) }));
vi.mock("@/hooks/use-gemini-live/mic-stream", () => ({
  claimMicStream: async () => ({ getTracks: () => [] }),
  parkMicStream: vi.fn(), detectNativeSampleRate: () => 24000,
}));
class AudioNodeMock {
  connect() {} disconnect() {}
  gain = { value: 0 };
  port = { postMessage: vi.fn() };
}
const callbacks = () => connect.mock.calls.at(-1)![0].callbacks;
const session = () => ({ close: vi.fn(), sendRealtimeInput: vi.fn() });
const setup = () => renderHook(() => useGeminiLive({
  userId: "user", userName: "Name", preferedVoice: {} as PreferedVoice,
  totalAllowedSeconds: 1800,
}));
beforeEach(() => {
  vi.useFakeTimers();
  connect.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("AudioWorkletNode", AudioNodeMock);
  vi.stubGlobal("AudioContext", class {
    state = "running"; sampleRate = 24000; destination = {};
    audioWorklet = { addModule: async () => {} };
    createGain() { return new AudioNodeMock(); }
    createMediaStreamSource() { return new AudioNodeMock(); }
    async close() { this.state = "closed"; }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Gemini reconnect ownership", () => {
  it("schedules only one retry when error, close and rejection report the same failure", async () => {
    connect.mockResolvedValueOnce(session());
    const { result } = setup();
    await act(() => result.current.connect());
    await act(async () => callbacks().onclose({ code: 1006 }));
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onerror(new Error("socket"));
      cb.onclose({ code: 1006 });
      throw new Error("handshake");
    });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(connect).toHaveBeenCalledTimes(2);
    connect.mockResolvedValueOnce(session());
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(connect).toHaveBeenCalledTimes(3);
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(connect).toHaveBeenCalledTimes(3);
    await act(() => result.current.disconnect());
  });
  it("recovers from rejection without close and cancels a pending retry on disconnect", async () => {
    connect.mockResolvedValueOnce(session());
    const { result } = setup();
    await act(() => result.current.connect());
    await act(async () => callbacks().onclose({ code: 1006 }));
    connect.mockRejectedValueOnce(new Error("no close"));
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(connect).toHaveBeenCalledTimes(2);
    connect.mockResolvedValueOnce(session());
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(connect).toHaveBeenCalledTimes(3);
    await act(async () => callbacks().onclose({ code: 1006 }));
    await act(() => result.current.disconnect());
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(connect).toHaveBeenCalledTimes(3);
  });
  it("gracefully rotates and passes previous resumption handle on msg.goAway", async () => {
    const s1 = session();
    connect.mockResolvedValueOnce(s1);
    const { result } = setup();
    await act(() => result.current.connect());
    expect(connect).toHaveBeenCalledTimes(1);

    // Initial connect: sessionResumption is empty {}
    const initialConfig = connect.mock.calls[0][0].config;
    expect(initialConfig.sessionResumption).toEqual({});

    // Server sends session resumption update with new handle
    act(() => {
      callbacks().onmessage({
        sessionResumptionUpdate: { newHandle: "handle-12345" },
      });
    });

    // Server sends goAway
    connect.mockResolvedValueOnce(session());
    await act(async () => {
      callbacks().onmessage({ goAway: {} });
    });

    // s1.close() should have been called
    expect(s1.close).toHaveBeenCalledTimes(1);

    // Trigger onclose callback that would be fired when socket closes
    await act(async () => {
      callbacks().onclose({ code: 1000 });
    });

    // Advance timer for 500ms reconnect delay
    await act(() => vi.advanceTimersByTimeAsync(500));

    // Reconnection was initiated
    expect(connect).toHaveBeenCalledTimes(2);

    // Resumed connect MUST include handle-12345!
    const resumedConfig = connect.mock.calls[1][0].config;
    expect(resumedConfig.sessionResumption).toEqual({ handle: "handle-12345" });

    await act(() => result.current.disconnect());
  });
});
