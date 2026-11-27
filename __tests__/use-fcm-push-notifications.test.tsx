import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessagePayload } from "firebase/messaging";

const hoisted = vi.hoisted(() => {
  return {
    mockPush: vi.fn(),
    mockGetFCMToken: vi.fn(async () => "web-token-shared"),
    mockOnMessage: vi.fn(),
    mockSaveFCMToken: vi.fn(async () => ({ success: true })),
    mockRemoveFCMToken: vi.fn(async () => ({ success: true })),
    mockGetLatestUnread: vi.fn(async () => ({
      success: true,
      notifications: [{ id: "n1", title: "Voice Ready", isRead: false }],
    })),
    mockToastInfo: vi.fn(),
    capturedOnMessage: null as ((payload: MessagePayload) => void) | null,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: hoisted.mockPush }),
}));

vi.mock("sonner", () => ({
  toast: { info: hoisted.mockToastInfo },
}));

vi.mock("@/firebase/client", () => ({
  getFCMToken: hoisted.mockGetFCMToken,
  messaging: vi.fn(async () => ({ app: "mock" })),
}));

vi.mock("firebase/messaging", () => ({
  onMessage: (_m: unknown, cb: (payload: MessagePayload) => void) => {
    hoisted.mockOnMessage();
    hoisted.capturedOnMessage = cb;
    return () => {};
  },
}));

vi.mock("@/lib/actions/notifications", () => ({
  saveFCMToken: hoisted.mockSaveFCMToken,
  removeFCMToken: hoisted.mockRemoveFCMToken,
  getNotifications: vi.fn(async () => ({ success: true, notifications: [] })),
  markAsRead: vi.fn(async () => ({ success: true })),
  markAllAsRead: vi.fn(async () => ({ success: true })),
  markAsUnread: vi.fn(async () => ({ success: true })),
  deleteNotification: vi.fn(async () => ({ success: true })),
  getLatestUnreadNotifications: hoisted.mockGetLatestUnread,
}));

const stableAuthState = { user: { id: "user-1" } };

vi.mock("@/store", () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector(stableAuthState),
}));

import { useFCMPushNotifications } from "@/hooks/use-fcm-push-notifications";
import { useNotifications } from "@/hooks/use-notifications";
import { setFcmClientState } from "@/lib/fcm-client-sync";

function RootProvider() {
  useFCMPushNotifications({ mountListener: true });
  return null;
}

function SettingsConsumer({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const { token } = useFCMPushNotifications();
  onToken(token);
  useNotifications();
  return null;
}

describe("useFCMPushNotifications + useNotifications integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    hoisted.capturedOnMessage = null;
    setFcmClientState({
      permission: "granted",
      isSupported: true,
      token: null,
      error: null,
    });

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("mounts a single foreground listener, shares token state, and refreshes notifications on push", async () => {
    const seenTokens: Array<string | null> = [];

    render(
      <>
        <RootProvider />
        <SettingsConsumer onToken={(t) => seenTokens.push(t)} />
      </>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hoisted.mockGetFCMToken).toHaveBeenCalledTimes(1);
    expect(hoisted.mockOnMessage).toHaveBeenCalledTimes(1);
    expect(seenTokens).toContain("web-token-shared");

    const callsBeforePush = hoisted.mockGetLatestUnread.mock.calls.length;

    await act(async () => {
      hoisted.capturedOnMessage?.({
        from: "fcm",
        messageId: "m-1",
        collapseKey: "",
        notification: { title: "Voice Ready", body: "Tap to view" },
        data: { url: "/dashboard/transcripts/s1" },
      });
      await Promise.resolve();
    });

    expect(hoisted.mockToastInfo).toHaveBeenCalledWith(
      "Voice Ready",
      expect.objectContaining({ description: "Tap to view" }),
    );
    expect(hoisted.mockGetLatestUnread.mock.calls.length).toBeGreaterThan(
      callsBeforePush,
    );
  });
});
