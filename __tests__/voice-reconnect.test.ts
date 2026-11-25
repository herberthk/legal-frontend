import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseGoAwayDelayMs, useGeminiLive } from "@/hooks/use-gemini-live";

const { connect, getEphemeralTokenMock, prefetchTokenMock, setTargetAtTimeMock } =
  vi.hoisted(() => ({
    connect: vi.fn(),
    getEphemeralTokenMock: vi.fn(async () => "local-token"),
    prefetchTokenMock: vi.fn(),
    setTargetAtTimeMock: vi.fn(),
  }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { live = { connect }; },
  Modality: { AUDIO: "AUDIO" },
  StartSensitivity: { START_SENSITIVITY_LOW: "START_SENSITIVITY_LOW" },
  EndSensitivity: { END_SENSITIVITY_LOW: "END_SENSITIVITY_LOW" },
  ActivityHandling: { START_OF_ACTIVITY_INTERRUPTS: "START_OF_ACTIVITY_INTERRUPTS" },
  TurnCoverage: { TURN_INCLUDES_ONLY_ACTIVITY: "TURN_INCLUDES_ONLY_ACTIVITY" },
}));
vi.mock("@zakj/no-sleep", () => ({ default: class { enable() {} disable() {} } }));
vi.mock("@/hooks/use-gemini-live/use-ephemeral-token", () => ({
  useEphemeralToken: () => ({
    getEphemeralToken: getEphemeralTokenMock,
    prefetchToken: prefetchTokenMock,
    clearCachedToken: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-gemini-live/use-firebase-sync", () => ({
  useFirebaseSync: ({
    allTranscriptsRef,
  }: {
    allTranscriptsRef: { current: Transcript[] };
  }) => ({
    syncSessionToBuffer: vi.fn(() => {
      // Mirror real useFirebaseSync behavior: persisted turns are drained from allTranscriptsRef
      allTranscriptsRef.current = [];
    }),
    heartbeatBuffer: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-gemini-live/audio-setup", () => ({
  DEFAULT_OUTPUT_GAIN: 1.05,
  createGeminiAudioChain: () => ({
    masterGain: {
      gain: { value: 1.05, setTargetAtTime: setTargetAtTimeMock },
    },
  }),
}));
vi.mock("@/hooks/use-gemini-live/mic-stream", () => ({
  claimMicStream: async () => ({
    getTracks: () => [],
    getAudioTracks: () => [{ enabled: true }],
  }),
  parkMicStream: vi.fn(),
  detectNativeSampleRate: () => 24000,
}));
const workletNodes: Record<string, AudioNodeMock> = {};
class AudioNodeMock {
  connect() {} disconnect() {}
  gain = { value: 0 };
  port: {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: ((e: { data: unknown }) => void) | null;
  } = { postMessage: vi.fn(), onmessage: null };
  constructor(_ctx?: unknown, name?: string) {
    if (name) workletNodes[name] = this;
  }
}
const callbacks = () => connect.mock.calls.at(-1)![0].callbacks;
const session = () => ({
  close: vi.fn(),
  sendRealtimeInput: vi.fn(),
  sendClientContent: vi.fn(),
});
const setup = () => renderHook(() => useGeminiLive({
  userId: "user", userName: "Name", preferedVoice: {} as PreferedVoice,
  totalAllowedSeconds: 1800,
}));
beforeEach(() => {
  vi.useFakeTimers();
  connect.mockReset();
  getEphemeralTokenMock.mockClear();
  prefetchTokenMock.mockClear();
  setTargetAtTimeMock.mockClear();
  for (const k of Object.keys(workletNodes)) delete workletNodes[k];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("AudioWorkletNode", AudioNodeMock);
  vi.stubGlobal("AudioContext", class {
    state = "running"; sampleRate = 24000; currentTime = 0; destination = {};
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
  it("keeps the initial session connecting until SDK setup resolves", async () => {
    let resolveSetup!: (value: ReturnType<typeof session>) => void;
    const pendingSetup = new Promise<ReturnType<typeof session>>((resolve) => {
      resolveSetup = resolve;
    });
    connect.mockImplementationOnce(({ callbacks: cb }) => {
      cb.onopen();
      return pendingSetup;
    });
    const { result } = setup();
    let connecting!: Promise<void>;
    await act(async () => { connecting = result.current.connect(); });
    expect(result.current.wsStatus).toBe("connecting");
    await act(async () => {
      resolveSetup(session());
      await connecting;
    });
    expect(result.current.wsStatus).toBe("open");
    await act(() => result.current.disconnect());
  });

  it("does not retry when a reconnect opens the socket but fails setup", async () => {
    connect.mockResolvedValueOnce(session());
    const { result } = setup();
    await act(() => result.current.connect());
    await act(async () => callbacks().onclose({ code: 1006 }));
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      cb.onclose({ code: 1008 });
      throw new Error("Live setup rejected");
    });
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(connect).toHaveBeenCalledTimes(2);
    expect(result.current.wsStatus).toBe("error");
    await act(() => result.current.disconnect());
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

    // Server sends session resumption update with new handle and an in-progress user turn
    act(() => {
      callbacks().onmessage({
        sessionResumptionUpdate: { newHandle: "handle-12345" },
      });
      callbacks().onmessage({
        serverContent: {
          inputTranscription: { text: "What about my " },
        },
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

    // Advance timer for reconnect
    await act(() => vi.advanceTimersByTimeAsync(500));

    // Reconnection was initiated
    expect(connect).toHaveBeenCalledTimes(2);

    // Resumed connect MUST include handle-12345!
    const resumedConfig = connect.mock.calls[1][0].config;
    expect(resumedConfig.sessionResumption).toEqual({ handle: "handle-12345" });

    // Resumed transcription continues seamlessly into a single unbroken user entry
    act(() => {
      callbacks().onmessage({
        serverContent: {
          inputTranscription: { text: "lease agreement?" },
          turnComplete: true,
        },
      });
    });
    expect(result.current.getTranscripts()).toEqual([
      { role: "user", content: "What about my lease agreement?" },
    ]);

    await act(() => result.current.disconnect());
  });

  it("triggers initial greeting via sendClientContent and ignores non-resumable handles", async () => {
    const s1 = session();
    connect.mockResolvedValueOnce(s1);
    const { result } = setup();
    await act(() => result.current.connect());

    expect(s1.sendClientContent).toHaveBeenCalledWith({
      turns: [{ role: "user", parts: [{ text: "Hello" }] }],
      turnComplete: true,
    });
    expect(s1.sendRealtimeInput).not.toHaveBeenCalled();

    // Seed a valid handle, then send a non-resumable update
    act(() => {
      callbacks().onmessage({
        sessionResumptionUpdate: { resumable: true, newHandle: "valid-handle" },
      });
      callbacks().onmessage({
        sessionResumptionUpdate: { resumable: false, newHandle: "bad-handle" },
      });
    });

    connect.mockResolvedValueOnce(session());
    await act(async () => {
      callbacks().onclose({ code: 1006 });
    });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(connect.mock.calls[1][0].config.sessionResumption).toEqual({
      handle: "valid-handle",
    });

    await act(() => result.current.disconnect());
  });

  it("defers goAway rotation until active model turn completes", async () => {
    const s1 = session();
    connect.mockResolvedValueOnce(s1);
    const { result } = setup();
    await act(() => result.current.connect());

    // Simulate incoming AI audio chunk (active model turn)
    act(() => {
      callbacks().onmessage({
        serverContent: {
          modelTurn: {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/pcm;rate=24000",
                  data: btoa("\x00\x00\x00\x00"),
                },
              },
            ],
          },
        },
      });
    });

    // goAway arrives mid-turn -> must NOT close immediately
    act(() => {
      callbacks().onmessage({ goAway: { timeLeft: "30s" } });
    });
    expect(s1.close).not.toHaveBeenCalled();

    // generationComplete arrives while audio is still playing -> must NOT close prematurely
    act(() => {
      callbacks().onmessage({ serverContent: { generationComplete: true } });
    });
    expect(s1.close).not.toHaveBeenCalled();

    // turnComplete arrives -> now closes gracefully
    act(() => {
      callbacks().onmessage({ serverContent: { turnComplete: true } });
    });
    expect(s1.close).toHaveBeenCalledTimes(1);

    await act(() => result.current.disconnect());
  });

  it("clears isProcessing on waitingForInput and sends 2m/10s notifications via sendClientContent", async () => {
    const s1 = session();
    connect.mockResolvedValueOnce(s1);
    const { result } = renderHook(() =>
      useGeminiLive({
        userId: "user",
        userName: "Name",
        preferedVoice: {} as PreferedVoice,
        totalAllowedSeconds: 400,
      }),
    );
    await act(() => result.current.connect());

    // Greeting starts in processing state
    expect(result.current.isProcessing).toBe(true);

    // waitingForInput clears processing
    act(() => {
      callbacks().onmessage({ serverContent: { waitingForInput: true } });
    });
    expect(result.current.isProcessing).toBe(false);

    // Advance to 2m remaining (400 - 120 = 280s) -> non-interrupting or idle turn
    await act(() => vi.advanceTimersByTimeAsync(280_000));
    expect(s1.sendClientContent).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [
          {
            role: "user",
            parts: [{ text: expect.stringContaining("2 minutes remaining") }],
          },
        ],
      }),
    );

    // Advance to 10s remaining (390s) -> turnComplete: true
    await act(() => vi.advanceTimersByTimeAsync(110_000));
    expect(s1.sendClientContent).toHaveBeenCalledWith({
      turns: [
        {
          role: "user",
          parts: [{ text: expect.stringContaining("session limit has been reached") }],
        },
      ],
      turnComplete: true,
    });

    await act(() => result.current.disconnect());
  });

  it("computes monotonic GoAway wait delays without exceeding short timeLeft deadlines", () => {
    expect(parseGoAwayDelayMs("0.5s")).toBe(0);
    expect(parseGoAwayDelayMs("1.5s")).toBe(0);
    expect(parseGoAwayDelayMs("2s")).toBe(1000);
    expect(parseGoAwayDelayMs("8s")).toBe(4000);
    expect(parseGoAwayDelayMs("30s")).toBe(10000);
    expect(parseGoAwayDelayMs(undefined)).toBe(2500);
  });

  it("closes immediately on goAway with imminent timeLeft even mid-turn", async () => {
    const s1 = session();
    connect.mockResolvedValueOnce(s1);
    const { result } = setup();
    await act(() => result.current.connect());

    act(() => {
      callbacks().onmessage({
        serverContent: {
          modelTurn: {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/pcm;rate=24000",
                  data: btoa("\x00\x00\x00\x00"),
                },
              },
            ],
          },
        },
      });
    });

    act(() => {
      callbacks().onmessage({ goAway: { timeLeft: "1s" } });
    });
    expect(s1.close).toHaveBeenCalledTimes(1);

    await act(() => result.current.disconnect());
  });

  it("holds mic frames during the 2.3s chime gate and sends audioStreamEnd once on mute", async () => {
    const s1 = session();
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = setup();
    await act(() => result.current.connect());

    const processor = workletNodes["pcm-processor"];
    expect(processor?.port.onmessage).toBeTypeOf("function");

    const frame = () => ({
      data: { pcm: new Int16Array(4).buffer, volume: 0.2, isSpeaking: true },
    });

    // Immediately after connect and mid-chime (<2300ms): chime gate drops frames
    act(() => {
      processor.port.onmessage?.(frame());
    });
    await act(() => vi.advanceTimersByTimeAsync(1_500));
    act(() => {
      processor.port.onmessage?.(frame());
    });
    expect(s1.sendRealtimeInput).not.toHaveBeenCalled();

    // After 2.3s chime hold window: frames stream to Gemini
    await act(() => vi.advanceTimersByTimeAsync(850));
    act(() => {
      processor.port.onmessage?.(frame());
    });
    expect(s1.sendRealtimeInput).toHaveBeenCalledTimes(1);

    // Muting sends audioStreamEnd once and suppresses further PCM frames
    act(() => {
      result.current.toggleMicMute(true);
      result.current.toggleMicMute(true);
      processor.port.onmessage?.(frame());
    });
    expect(s1.sendRealtimeInput).toHaveBeenCalledTimes(2);
    expect(s1.sendRealtimeInput).toHaveBeenLastCalledWith({
      audioStreamEnd: true,
    });

    await act(() => result.current.disconnect());
  });

  it("recovers from sendRealtimeInput errors without tight-loop spam even if onclose never fires", async () => {
    const s1 = session();
    s1.sendRealtimeInput.mockImplementation(() => {
      throw new Error("WebSocket is already in CLOSING or CLOSED state");
    });
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = setup();
    await act(() => result.current.connect());

    await act(() => vi.advanceTimersByTimeAsync(2_350));

    const processor = workletNodes["pcm-processor"];
    const frame = () => ({
      data: { pcm: new Int16Array(4).buffer, volume: 0.2, isSpeaking: true },
    });

    const s2 = session();
    connect.mockResolvedValueOnce(s2);

    // Emit multiple 25 Hz frames after failure; close/sendRealtimeInput must only fire once
    act(() => {
      processor.port.onmessage?.(frame());
      processor.port.onmessage?.(frame());
      processor.port.onmessage?.(frame());
    });
    expect(s1.sendRealtimeInput).toHaveBeenCalledTimes(1);
    expect(s1.close).toHaveBeenCalledTimes(1);

    // Reconnect timer fires even without onclose being emitted
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(connect).toHaveBeenCalledTimes(2);

    await act(() => result.current.disconnect());
  });

  it("does not surface a terminal error when close() fires onclose synchronously on sendRealtimeInput failure", async () => {
    const onError = vi.fn();
    const s1 = session();
    s1.sendRealtimeInput.mockImplementation(() => {
      throw new Error("Socket broken");
    });
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      s1.close.mockImplementation(() => {
        cb.onclose({ code: 1006, reason: "Abnormal" });
      });
      return s1;
    });
    const { result } = renderHook(() =>
      useGeminiLive({
        userId: "user",
        userName: "Name",
        preferedVoice: {} as PreferedVoice,
        totalAllowedSeconds: 1800,
        onError,
      }),
    );
    await act(() => result.current.connect());
    await act(() => vi.advanceTimersByTimeAsync(2_350));

    const processor = workletNodes["pcm-processor"];
    connect.mockResolvedValueOnce(session());

    act(() => {
      processor.port.onmessage?.({
        data: { pcm: new Int16Array(4).buffer, volume: 0.2, isSpeaking: true },
      });
    });

    // Synchronous onclose must not flip wsStatus to error/closed or trigger onError
    expect(result.current.wsStatus).toBe("open");
    expect(onError).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(connect).toHaveBeenCalledTimes(2);

    await act(() => result.current.disconnect());
  });

  it("un-ducks mic via turn-stall fallback, clears stuck processing after 8s, and pauses billing while reconnecting", async () => {
    const s1 = session();
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = setup();
    await act(() => result.current.connect());

    // Greeting starts processing; if no response arrives within 8s, isProcessing clears
    expect(result.current.isProcessing).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(8_000));
    expect(result.current.isProcessing).toBe(false);

    // Incoming AI audio ducks mic synchronously
    const processor = workletNodes["pcm-processor"];
    const player = workletNodes["pcm-player-processor"];
    act(() => {
      callbacks().onmessage({
        serverContent: {
          modelTurn: {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/pcm;rate=24000",
                  data: btoa("\x00\x00\x00\x00"),
                },
              },
            ],
          },
        },
      });
    });
    expect(processor.port.postMessage).toHaveBeenLastCalledWith({
      command: "aiSpeaking",
      value: true,
    });

    // bufferEmpty without turnComplete starts 2.5s stall fallback to un-duck mic
    act(() => {
      player.port.onmessage?.({ data: { type: "bufferEmpty" } });
    });
    await act(() => vi.advanceTimersByTimeAsync(2_500));
    expect(processor.port.postMessage).toHaveBeenLastCalledWith({
      command: "aiSpeaking",
      value: false,
    });

    // Duration pauses while reconnecting
    const durationBeforeDrop = result.current.duration;
    let resolveReconnect!: (value: ReturnType<typeof session>) => void;
    connect.mockImplementationOnce(
      () =>
        new Promise<ReturnType<typeof session>>((resolve) => {
          resolveReconnect = resolve;
        }),
    );
    await act(async () => {
      callbacks().onclose({ code: 1006 });
    });
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(result.current.duration).toBe(durationBeforeDrop);

    await act(async () => {
      resolveReconnect(session());
    });
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(result.current.duration).toBe(durationBeforeDrop + 2);

    await act(() => result.current.disconnect());
  });

  it("soft-ducks speaker output on barge-in and respects audio mute", async () => {
    const s1 = session();
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = setup();
    await act(() => result.current.connect());
    await act(() => vi.advanceTimersByTimeAsync(2_350));

    const processor = workletNodes["pcm-processor"];
    setTargetAtTimeMock.mockClear();

    // Barge-in starts -> ducks speaker gain to 0.15
    act(() => {
      processor.port.onmessage?.({
        data: {
          pcm: new Int16Array(4).buffer,
          volume: 0.2,
          isSpeaking: true,
          bargedIn: true,
        },
      });
    });
    expect(setTargetAtTimeMock).toHaveBeenLastCalledWith(0.15, 0, 0.02);

    // Barge-in ends -> restores full output gain (1.05)
    act(() => {
      processor.port.onmessage?.({
        data: {
          pcm: new Int16Array(4).buffer,
          volume: 0.01,
          isSpeaking: false,
          bargedIn: false,
        },
      });
    });
    expect(setTargetAtTimeMock).toHaveBeenLastCalledWith(1.05, 0, 0.02);

    // When audio is muted by user, barge-in transitions must NOT unmute gain
    act(() => {
      result.current.toggleAudioMute(true);
    });
    setTargetAtTimeMock.mockClear();
    act(() => {
      processor.port.onmessage?.({
        data: {
          pcm: new Int16Array(4).buffer,
          volume: 0.2,
          isSpeaking: true,
          bargedIn: true,
        },
      });
      processor.port.onmessage?.({
        data: {
          pcm: new Int16Array(4).buffer,
          volume: 0.01,
          isSpeaking: false,
          bargedIn: false,
        },
      });
    });
    expect(setTargetAtTimeMock).not.toHaveBeenCalled();

    await act(() => result.current.disconnect());
  });

  it("pre-warms reconnect token on GoAway and 8.5m, buffers user speech across 0ms handoff, and re-seeds context if handle is missing", async () => {
    const s1 = session();
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = setup();
    await act(() => result.current.connect());

    // Advance 8.5 minutes (510s) -> proactive token pre-warm fires
    await act(() => vi.advanceTimersByTimeAsync(510_000));
    expect(prefetchTokenMock).toHaveBeenCalledTimes(1);

    // Capture a conversation turn so fallback context re-seeding has history
    act(() => {
      callbacks().onmessage({
        serverContent: {
          inputTranscription: { text: "What about my tenancy notice?" },
        },
      });
      callbacks().onmessage({
        serverContent: {
          outputTranscription: { text: "Under the Landlord and Tenant Act..." },
          turnComplete: true,
        },
      });
    });

    // GoAway arrives (without any resumption handle saved) -> immediately prefetches & closes
    act(() => {
      callbacks().onmessage({ goAway: { timeLeft: "30s" } });
    });
    expect(prefetchTokenMock).toHaveBeenCalledTimes(2);
    expect(s1.close).toHaveBeenCalledTimes(1);

    // Hold the reconnect socket open while user speaks during handoff
    const s2 = session();
    let resolveReconnect!: (value: ReturnType<typeof session>) => void;
    connect.mockImplementationOnce(
      () =>
        new Promise<ReturnType<typeof session>>((resolve) => {
          resolveReconnect = resolve;
        }),
    );

    await act(async () => {
      callbacks().onclose({ code: 1000 });
    });

    // Clean GoAway handoff runs at 0ms and consumes pre-warmed token (forceRefresh=false)
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(connect).toHaveBeenCalledTimes(2);
    expect(getEphemeralTokenMock).toHaveBeenLastCalledWith(
      false,
      1800,
      undefined,
      undefined,
    );

    // User speaks during the brief handoff -> speech frames are buffered instead of dropped
    const processor = workletNodes["pcm-processor"];
    act(() => {
      processor.port.onmessage?.({
        data: { pcm: new Int16Array([100, 200]).buffer, volume: 0.2, isSpeaking: true },
      });
      processor.port.onmessage?.({
        data: { pcm: new Int16Array([300, 400]).buffer, volume: 0.2, isSpeaking: true },
      });
    });
    expect(s2.sendRealtimeInput).not.toHaveBeenCalled();

    // Resumed socket completes setup -> re-seeds context (no handle) & flushes buffered speech
    await act(async () => {
      resolveReconnect(s2);
    });
    expect(s2.sendClientContent).toHaveBeenCalledWith(
      expect.objectContaining({
        turnComplete: false,
        turns: expect.arrayContaining([
          expect.objectContaining({ role: "user" }),
          expect.objectContaining({ role: "model" }),
        ]),
      }),
    );
    expect(s2.sendRealtimeInput).toHaveBeenCalledTimes(2);

    await act(() => result.current.disconnect());
  });

  it("defers GoAway while user is actively speaking and merges continuity notice into trailing unfinalized user turn", async () => {
    const s1 = session();
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = setup();
    await act(() => result.current.connect());
    await act(() => vi.advanceTimersByTimeAsync(2_350));

    const processor = workletNodes["pcm-processor"];
    // User is actively speaking
    act(() => {
      processor.port.onmessage?.({
        data: { pcm: new Int16Array(4).buffer, volume: 0.2, isSpeaking: true },
      });
      callbacks().onmessage({
        serverContent: {
          inputTranscription: { text: "What about my employment contract" },
        },
      });
    });

    // GoAway arrives mid-user-sentence -> must defer rather than cutting off immediately
    act(() => {
      callbacks().onmessage({ goAway: { timeLeft: "20s" } });
    });
    expect(s1.close).not.toHaveBeenCalled();

    // Deferred GoAway timer fires -> closes and finalizes in-progress user turn
    const s2 = session();
    connect.mockResolvedValueOnce(s2);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(s1.close).toHaveBeenCalledTimes(1);

    await act(async () => {
      callbacks().onclose({ code: 1000 });
    });
    await act(() => vi.advanceTimersByTimeAsync(0));

    // Re-seeded turns should preserve the unfinalized user text and merge continuity notice into that same user turn
    expect(s2.sendClientContent).toHaveBeenCalledWith({
      turns: [
        {
          role: "user",
          parts: [
            { text: "What about my employment contract" },
            { text: expect.stringContaining("Connection resumed mid-call") },
          ],
        },
      ],
      turnComplete: false,
    });

    await act(() => result.current.disconnect());
  });

  it("drops stale reconnect speech older than 3s, enforces 50-frame cap, and clears buffer/ducking on mic mute", async () => {
    const s1 = session();
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = setup();
    await act(() => result.current.connect());
    await act(() => vi.advanceTimersByTimeAsync(2_350));

    const processor = workletNodes["pcm-processor"];
    // Trigger barge-in ducking, then mute mic -> output ducking restores synchronously
    setTargetAtTimeMock.mockClear();
    act(() => {
      processor.port.onmessage?.({
        data: {
          pcm: new Int16Array(4).buffer,
          volume: 0.2,
          isSpeaking: true,
          bargedIn: true,
        },
      });
    });
    expect(setTargetAtTimeMock).toHaveBeenLastCalledWith(0.15, 0, 0.02);
    act(() => {
      result.current.toggleMicMute(true);
    });
    expect(setTargetAtTimeMock).toHaveBeenLastCalledWith(1.05, 0, 0.02);
    act(() => {
      result.current.toggleMicMute(false);
    });

    // Drop connection and hold reconnect open
    const s2 = session();
    let resolveReconnect!: (value: ReturnType<typeof session>) => void;
    connect.mockImplementationOnce(
      () =>
        new Promise<ReturnType<typeof session>>((resolve) => {
          resolveReconnect = resolve;
        }),
    );
    await act(async () => {
      callbacks().onclose({ code: 1006 });
    });

    // Buffer 10 stale frames before a 4s outage delay, then 55 fresh frames (capped at 50)
    act(() => {
      for (let i = 0; i < 10; i++) {
        processor.port.onmessage?.({
          data: { pcm: new Int16Array([1, 2]).buffer, volume: 0.2, isSpeaking: true },
        });
      }
    });
    await act(() => vi.advanceTimersByTimeAsync(4_000));
    act(() => {
      for (let i = 0; i < 55; i++) {
        processor.port.onmessage?.({
          data: { pcm: new Int16Array([3, 4]).buffer, volume: 0.2, isSpeaking: true },
        });
      }
    });

    await act(async () => {
      resolveReconnect(s2);
    });
    // Only the capped 50 fresh frames flush (stale frames dropped, cap enforced)
    expect(s2.sendRealtimeInput).toHaveBeenCalledTimes(50);

    // Next drop: muting mid-handoff wipes buffered speech so pre-mute words are not flushed
    const s3 = session();
    let resolveReconnect2!: (value: ReturnType<typeof session>) => void;
    connect.mockImplementationOnce(
      () =>
        new Promise<ReturnType<typeof session>>((resolve) => {
          resolveReconnect2 = resolve;
        }),
    );
    await act(async () => {
      callbacks().onclose({ code: 1000 });
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    act(() => {
      processor.port.onmessage?.({
        data: { pcm: new Int16Array([5, 6]).buffer, volume: 0.2, isSpeaking: true },
      });
      result.current.toggleMicMute(true);
    });
    await act(async () => {
      resolveReconnect2(s3);
    });
    expect(s3.sendRealtimeInput).not.toHaveBeenCalled();

    await act(() => result.current.disconnect());
  });

  it("preserves barge-in ducking across incoming AI PCM chunks and audio unmute until barge-in ends", async () => {
    const s1 = session();
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = setup();
    await act(() => result.current.connect());
    await act(() => vi.advanceTimersByTimeAsync(2_350));

    const processor = workletNodes["pcm-processor"];
    setTargetAtTimeMock.mockClear();

    // Barge-in begins -> gain ducks to 0.15
    act(() => {
      processor.port.onmessage?.({
        data: {
          pcm: new Int16Array(4).buffer,
          volume: 0.2,
          isSpeaking: true,
          bargedIn: true,
        },
      });
    });
    expect(setTargetAtTimeMock).toHaveBeenLastCalledWith(0.15, 0, 0.02);

    // Another AI PCM chunk arrives before Gemini processes the interruption -> must NOT restore 1.05
    setTargetAtTimeMock.mockClear();
    act(() => {
      callbacks().onmessage({
        serverContent: {
          modelTurn: {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/pcm;rate=24000",
                  data: btoa("\x00\x00\x00\x00"),
                },
              },
            ],
          },
        },
      });
    });
    expect(setTargetAtTimeMock).not.toHaveBeenCalled();

    // User mutes and unmutes speaker while barge-in is still active -> unmute restores 0.15 (not 1.05)
    act(() => {
      result.current.toggleAudioMute(true);
    });
    expect(setTargetAtTimeMock).toHaveBeenLastCalledWith(0, 0, 0.01);
    act(() => {
      result.current.toggleAudioMute(false);
    });
    expect(setTargetAtTimeMock).toHaveBeenLastCalledWith(0.15, 0, 0.01);

    // Barge-in ends -> normal output gain 1.05 is restored
    act(() => {
      processor.port.onmessage?.({
        data: {
          pcm: new Int16Array(4).buffer,
          volume: 0.01,
          isSpeaking: false,
          bargedIn: false,
        },
      });
    });
    expect(setTargetAtTimeMock).toHaveBeenLastCalledWith(1.05, 0, 0.02);

    await act(() => result.current.disconnect());
  });

  it.each([
    { handle: null, retainedFrames: [0, 1, 2] },
    { handle: "resume-handle", retainedFrames: [1, 2] },
  ])("ignores chime-hold speech and retries failed replay with handle $handle", async ({ handle, retainedFrames }) => {
    const onUserAudioChunk = vi.fn();
    const s1 = session();
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = renderHook(() =>
      useGeminiLive({
        userId: "user",
        userName: "Name",
        preferedVoice: {} as PreferedVoice,
        totalAllowedSeconds: 1800,
        onUserAudioChunk,
      }),
    );
    await act(() => result.current.connect());
    if (handle) {
      await act(async () => {
        callbacks().onmessage({
          sessionResumptionUpdate: { newHandle: handle, resumable: true },
        });
      });
    }

    // Socket drops immediately during the 2.3s connected chime hold
    let resolveReconnect1!: (value: ReturnType<typeof session>) => void;
    connect.mockImplementationOnce(
      () =>
        new Promise<ReturnType<typeof session>>((resolve) => {
          resolveReconnect1 = resolve;
        }),
    );
    await act(async () => {
      callbacks().onclose({ code: 1006 });
    });
    await act(() => vi.advanceTimersByTimeAsync(500));

    const processor = workletNodes["pcm-processor"];
    // Frame during chime hold (500ms < 2300ms) must NOT be buffered or sent to recorder
    act(() => {
      processor.port.onmessage?.({
        data: { pcm: new Int16Array([9, 9]).buffer, volume: 0.3, isSpeaking: true },
      });
    });
    expect(onUserAudioChunk).not.toHaveBeenCalled();

    // Advance past chime hold (total 2350ms) and capture 3 frames A, B, C
    await act(() => vi.advanceTimersByTimeAsync(1_850));
    const frameA = new Int16Array([1, 2]).buffer;
    const frameB = new Int16Array([3, 4]).buffer;
    const frameC = new Int16Array([5, 6]).buffer;
    act(() => {
      processor.port.onmessage?.({ data: { pcm: frameA, volume: 0.2, isSpeaking: true } });
      processor.port.onmessage?.({ data: { pcm: frameB, volume: 0.2, isSpeaking: true } });
      processor.port.onmessage?.({ data: { pcm: frameC, volume: 0.2, isSpeaking: true } });
    });
    expect(onUserAudioChunk).toHaveBeenCalledTimes(3);

    // The replacement socket accepts A, throws on B, and is closed.
    const s2 = session();
    s2.sendRealtimeInput
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("Socket dropped mid-replay");
      });
    const s3 = session();
    connect.mockResolvedValueOnce(s3);

    await act(async () => {
      resolveReconnect1(s2);
    });
    expect(s2.sendRealtimeInput).toHaveBeenCalledTimes(2);
    expect(s2.close).toHaveBeenCalledTimes(1);

    // A new session needs A, B, and C; a resumed session only needs B and C.
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(connect).toHaveBeenCalledTimes(3);
    const frames = [frameA, frameB, frameC];
    expect(s3.sendRealtimeInput.mock.calls.map(([input]) => input.audio.data)).toEqual(
      retainedFrames.map((index) =>
        btoa(String.fromCharCode(...new Uint8Array(frames[index]))),
      ),
    );

    await act(() => result.current.disconnect());
  });

  it("stops reconnecting at the retry limit when replay keeps failing", async () => {
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return session();
    });
    const { result } = setup();
    await act(() => result.current.connect());
    await act(() => vi.advanceTimersByTimeAsync(2300));
    await act(async () => callbacks().onclose({ code: 1006 }));

    for (const delay of [500, 1000, 1500, 2000, 2500]) {
      const failingSession = session();
      failingSession.sendRealtimeInput.mockImplementation(() => {
        throw new Error("Replay failed");
      });
      connect.mockResolvedValueOnce(failingSession);
      // Keep speech in the buffer even as older chunks expire during backoff.
      act(() => {
        workletNodes["pcm-processor"].port.onmessage?.({
          data: { pcm: new Int16Array([1, 2]).buffer, volume: 0.2, isSpeaking: true },
        });
      });
      await act(() => vi.advanceTimersByTimeAsync(delay));
      expect(failingSession.close).toHaveBeenCalledTimes(1);
    }

    expect(result.current.wsStatus).toBe("error");
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(connect).toHaveBeenCalledTimes(6);
    await act(() => result.current.disconnect());
  });

  it("reseeds handle-less reconnect from bounded per-call history even after Firestore sync drains allTranscriptsRef, and clears history on a new call", async () => {
    const s1 = session();
    connect.mockImplementationOnce(async ({ callbacks: cb }) => {
      cb.onopen();
      return s1;
    });
    const { result } = setup();
    await act(() => result.current.connect());

    act(() => {
      callbacks().onmessage({
        serverContent: {
          inputTranscription: { text: "My landlord gave 7 days notice." },
        },
      });
      callbacks().onmessage({
        serverContent: {
          outputTranscription: { text: "Under the Act, notice periods depend on the tenancy." },
          turnComplete: true,
        },
      });
    });

    // Advance 10s so syncSessionToBuffer drains allTranscriptsRef to []
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(result.current.getTranscripts()).toEqual([]);

    // Handle-less reconnect still reseeds the persisted conversation turns + continuity notice
    const s2 = session();
    connect.mockResolvedValueOnce(s2);
    await act(async () => {
      callbacks().onclose({ code: 1006 });
    });
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(s2.sendClientContent).toHaveBeenCalledWith({
      turns: [
        { role: "user", parts: [{ text: "My landlord gave 7 days notice." }] },
        {
          role: "model",
          parts: [{ text: "Under the Act, notice periods depend on the tenancy." }],
        },
        {
          role: "user",
          parts: [{ text: expect.stringContaining("Connection resumed mid-call") }],
        },
      ],
      turnComplete: false,
    });

    // End call and start a fresh call -> prior call's history must NOT leak into a handle-less reconnect
    await act(() => result.current.disconnect());
    const s3 = session();
    connect.mockResolvedValueOnce(s3);
    await act(() => result.current.connect());

    const s4 = session();
    connect.mockResolvedValueOnce(s4);
    await act(async () => {
      callbacks().onclose({ code: 1006 });
    });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(s4.sendClientContent).not.toHaveBeenCalled();

    await act(() => result.current.disconnect());
  });

  it("fires 5m, 2m, and 10s duration notices for fractional credit allowances", async () => {
    const s1 = session();
    const onDurationLimitReached = vi.fn();
    connect.mockResolvedValueOnce(s1);
    const { result } = renderHook(() =>
      useGeminiLive({
        userId: "user",
        userName: "Name",
        preferedVoice: {} as PreferedVoice,
        totalAllowedSeconds: 900.5,
        onDurationLimitReached,
      }),
    );
    await act(() => result.current.connect());

    // Clear initial "Hello" turn
    s1.sendClientContent.mockClear();

    // endTick = ceil(900.5) = 901 -> 5m at 601s, 2m at 781s, 10s at 891s, end at 901s
    await act(() => vi.advanceTimersByTimeAsync(601_000));
    expect(s1.sendClientContent).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [
          {
            role: "user",
            parts: [{ text: expect.stringContaining("5 minutes remaining") }],
          },
        ],
      }),
    );

    await act(() => vi.advanceTimersByTimeAsync(180_000));
    expect(s1.sendClientContent).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [
          {
            role: "user",
            parts: [{ text: expect.stringContaining("2 minutes remaining") }],
          },
        ],
      }),
    );

    await act(() => vi.advanceTimersByTimeAsync(110_000));
    expect(s1.sendClientContent).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [
          {
            role: "user",
            parts: [{ text: expect.stringContaining("session limit has been reached") }],
          },
        ],
        turnComplete: true,
      }),
    );

    expect(onDurationLimitReached).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(onDurationLimitReached).toHaveBeenCalledTimes(1);

    await act(() => result.current.disconnect());
  });
});
