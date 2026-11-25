import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GeminiVoiceConnection from "@/components/voice/gemini-voice-connection";

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockToggleMicMute = vi.fn();
const mockToggleAudioMute = vi.fn();
const mockGetTranscripts = vi.fn();
const mockPrefetchToken = vi.fn();

let hookReturnState = {
  wsStatus: "idle" as VoiceSessionStatus,
  audioStatus: "idle" as VoiceAudioStatus,
  isListening: false,
  isProcessing: false,
  activeTranscript: null as AgentTranscript | null,
  duration: 0,
  remainingSeconds: 600,
  sessionId: "sess-1",
  connect: mockConnect,
  disconnect: mockDisconnect,
  toggleMicMute: mockToggleMicMute,
  toggleAudioMute: mockToggleAudioMute,
  getTranscripts: mockGetTranscripts,
  prefetchToken: mockPrefetchToken,
  micLevel: 0,
  aiAudioLevel: 0,
};

vi.mock("@/hooks/use-gemini-live", () => ({
  useGeminiLive: () => hookReturnState,
}));

vi.mock("@/hooks/use-conversation-recorder", () => ({
  useConversationRecorder: () => ({
    startSession: vi.fn(),
    addUserChunk: vi.fn(),
    addAIChunk: vi.fn(),
    finalizeRecording: vi.fn(),
    encodingProgress: 0,
    cleanup: vi.fn(),
  }),
}));

vi.mock("@/store", () => ({
  useAuthStore: (selector: (s: { user: { id: string; name: string; preferedVoice: PreferedVoice } }) => unknown) =>
    selector({
      user: {
        id: "user-1",
        name: "Ada Lovelace",
        preferedVoice: { preferedVoiceId: "Aoede", preferedVoiceName: "Evelyn" },
      },
    }),
}));

vi.mock("@/firebase/client", () => ({
  logAnalyticsEvent: vi.fn(),
}));

vi.mock("@/lib/actions/pushNotification", () => ({
  sendSingleNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/components/voice/voice-interface", () => ({
  default: (props: {
    onStart: () => void;
    onEnd: () => void;
    isMuted: boolean;
    setIsMuted: (v: boolean) => void;
  }) => (
    <div>
      <button data-testid="start" onClick={props.onStart}>
        Start
      </button>
      <button data-testid="end" onClick={props.onEnd}>
        End
      </button>
      <button data-testid="mute" onClick={() => props.setIsMuted(true)}>
        Mute
      </button>
      <span data-testid="muted-state">{String(props.isMuted)}</span>
    </div>
  ),
}));

describe("GeminiVoiceConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
    mockGetTranscripts.mockReturnValue([{ role: "user", content: "Hi" }]);
    hookReturnState = {
      ...hookReturnState,
      wsStatus: "idle",
      duration: 0,
      sessionId: "sess-1",
    };

    vi.stubGlobal(
      "Audio",
      class {
        loop = false;
        currentTime = 0;
        play = vi.fn().mockResolvedValue(undefined);
        pause = vi.fn();
      },
    );
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        destination = {};
        createMediaElementSource = () => ({ connect: vi.fn() });
        createGain = () => ({ gain: { value: 1 }, connect: vi.fn() });
        resume = vi.fn().mockResolvedValue(undefined);
        close = vi.fn().mockResolvedValue(undefined);
      },
    );
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resets mic and audio mute synchronously before connect() starts a new call", async () => {
    render(<GeminiVoiceConnection freeVoiceSeconds={600} balance={0} />);

    fireEvent.click(screen.getByTestId("mute"));
    expect(screen.getByTestId("muted-state").textContent).toBe("true");
    mockToggleMicMute.mockClear();
    mockToggleAudioMute.mockClear();

    const callOrder: string[] = [];
    mockToggleMicMute.mockImplementation((val: boolean) => {
      callOrder.push(`mic:${val}`);
    });
    mockConnect.mockImplementation(async () => {
      callOrder.push("connect");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("start"));
    });

    expect(callOrder[0]).toBe("mic:false");
    expect(callOrder).toContain("connect");
    expect(callOrder.indexOf("mic:false")).toBeLessThan(
      callOrder.indexOf("connect"),
    );
    expect(mockToggleAudioMute).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("muted-state").textContent).toBe("false");
  });

  it("deduplicates fallback beacons per {sessionId, duration}, retries failed queues, and flushes new seconds after resume", async () => {
    const sendBeacon = vi.fn();
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });

    hookReturnState.wsStatus = "open";
    hookReturnState.duration = 12;

    const { rerender, unmount } = render(
      <GeminiVoiceConnection freeVoiceSeconds={600} balance={0} />,
    );

    // First queue attempt fails -> not marked sent, so next event retries
    sendBeacon.mockReturnValueOnce(false);
    fireEvent(window, new Event("pagehide"));
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    // Succeeds for duration 12 -> second identical beforeunload is deduplicated
    sendBeacon.mockReturnValueOnce(true);
    fireEvent(window, new Event("beforeunload"));
    fireEvent(window, new Event("pagehide"));
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    const secondPayload = JSON.parse(
      await (sendBeacon.mock.calls[1]?.[1] as Blob).text(),
    );
    expect(secondPayload).toMatchObject({ sessionId: "sess-1", duration: 12 });

    // User stays on call and duration advances -> unmount flushes updated duration
    hookReturnState = { ...hookReturnState, duration: 45 };
    rerender(<GeminiVoiceConnection freeVoiceSeconds={600} balance={0} />);
    sendBeacon.mockReturnValueOnce(true);
    unmount();

    expect(sendBeacon).toHaveBeenCalledTimes(3);
    const thirdPayload = JSON.parse(
      await (sendBeacon.mock.calls[2]?.[1] as Blob).text(),
    );
    expect(thirdPayload).toMatchObject({ sessionId: "sess-1", duration: 45 });
  });

  it("re-arms fallback beacon deduplication when the page returns so a later exit at the same duration retries", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });

    hookReturnState.wsStatus = "open";
    hookReturnState.duration = 12;

    const { unmount } = render(
      <GeminiVoiceConnection freeVoiceSeconds={600} balance={0} />,
    );

    // First exit queues duration 12; duplicate event in same exit is suppressed
    fireEvent(window, new Event("pagehide"));
    fireEvent(window, new Event("beforeunload"));
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    // Page returns before next timer tick -> dedup re-arms
    fireEvent(window, new Event("pageshow"));

    // Immediate SPA exit at the same duration 12 retries the beacon
    unmount();
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    const retryPayload = JSON.parse(
      await (sendBeacon.mock.calls[1]?.[1] as Blob).text(),
    );
    expect(retryPayload).toMatchObject({ sessionId: "sess-1", duration: 12 });
  });
});
