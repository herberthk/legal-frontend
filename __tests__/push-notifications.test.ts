import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  return {
    mockGetCurrentUser: vi.fn(),
    mockSaveFCMToken: vi.fn(),
    mockRemoveFCMToken: vi.fn(),
    mockFetch: vi.fn(),
    mockDocGet: vi.fn(),
    mockDocSet: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/actions/auth", () => ({
  getCurrentUser: hoisted.mockGetCurrentUser,
}));

vi.mock("@/lib/actions/notifications", () => ({
  saveFCMToken: hoisted.mockSaveFCMToken,
  removeFCMToken: hoisted.mockRemoveFCMToken,
}));

vi.mock("@/firebase/client", () => ({
  getFCMToken: vi.fn(async () => "web-token-1"),
  messaging: vi.fn(async () => null),
}));

vi.mock("@/firebase/admin", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: hoisted.mockDocGet,
        set: hoisted.mockDocSet,
      }),
    }),
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TS" },
}));

import {
  sendMultipleNotifications,
  sendSingleNotification,
} from "@/lib/actions/pushNotification";
import {
  cleanupRevokedWebPushToken,
  getFcmClientState,
  readCachedWebToken,
  resolveForegroundLink,
  setFcmClientState,
  subscribeFcmClientState,
  syncCurrentWebPushToken,
  syncWebPushToken,
  unregisterWebPushToken,
} from "@/lib/fcm-client-sync";
import { getFCMToken } from "@/firebase/client";
import { resolveNotificationTargetUrl } from "@/lib/push-url";
import { __resetWebPushRateLimitForTests } from "@/lib/push-notifications";
import { POST as singlePushRoute } from "@/app/api/notifications/single-push/route";
import { POST as multiplePushRoute } from "@/app/api/notifications/multiple-push/route";
import { saveFCMTokenFor } from "@/services/fcm";

describe("web push notifications", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", hoisted.mockFetch);
    process.env.PUSH_API_SECRET = "web-secret";
    window.localStorage.clear();
    __resetWebPushRateLimitForTests();
    hoisted.mockGetCurrentUser.mockReset();
    hoisted.mockSaveFCMToken.mockReset();
    hoisted.mockRemoveFCMToken.mockReset();
    hoisted.mockFetch.mockReset();
    hoisted.mockDocGet.mockReset();
    hoisted.mockDocSet.mockReset();
  });

  it("blocks non-admin user from sending single notification to another user", async () => {
    hoisted.mockGetCurrentUser.mockResolvedValue({ id: "u1", role: "USER" });

    const res = await sendSingleNotification({
      to: "u2",
      title: "Hi",
      message: "Body",
      link: "/notifications",
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Forbidden/i);
    expect(hoisted.mockFetch).not.toHaveBeenCalled();
  });

  it("allows user to send single notification to themselves with x-push-secret", async () => {
    hoisted.mockGetCurrentUser.mockResolvedValue({ id: "u1", role: "USER" });
    hoisted.mockFetch.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({ success: true, message: "ok", sent: 1, failed: 0 }),
    });

    const res = await sendSingleNotification({
      to: "u1",
      title: "Voice Ready",
      message: "Available",
      link: "/dashboard/transcripts/s1",
      dedupeKey: "voice-ready:s1",
    });

    expect(res.success).toBe(true);
    expect(hoisted.mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = hoisted.mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-push-secret"]).toBe(
      "web-secret",
    );
  });

  it("forbids non-admin from calling sendMultipleNotifications", async () => {
    hoisted.mockGetCurrentUser.mockResolvedValue({ id: "u1", role: "USER" });

    const res = await sendMultipleNotifications({
      userIds: ["u1", "u2"],
      title: "Notice",
      message: "Hello",
      link: "/notifications",
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Forbidden/i);
  });

  it("allows admin to call sendMultipleNotifications", async () => {
    hoisted.mockGetCurrentUser.mockResolvedValue({ id: "admin1", role: "ADMIN" });
    hoisted.mockFetch.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({ success: true, message: "sent", sent: 2, failed: 0 }),
    });

    const res = await sendMultipleNotifications({
      userIds: ["u1", "u2"],
      excludeUserId: "admin1",
      title: "Update",
      message: "Check dashboard",
      link: "/dashboard",
    });

    expect(res.success).toBe(true);
    expect(res.sent).toBe(2);
  });

  it("skips saveFCMToken when cached token for user is unchanged, and replaces old token when rotated", async () => {
    hoisted.mockSaveFCMToken.mockResolvedValue({ success: true });
    hoisted.mockRemoveFCMToken.mockResolvedValue({ success: true });
    hoisted.mockRemoveFCMToken.mockResolvedValue({ success: true });

    const first = await syncWebPushToken("u1", "tok-a");
    expect(first.status).toBe("updated");
    expect(hoisted.mockSaveFCMToken).toHaveBeenCalledTimes(1);

    const second = await syncWebPushToken("u1", "tok-a");
    expect(second.status).toBe("unchanged");
    expect(hoisted.mockSaveFCMToken).toHaveBeenCalledTimes(1);

    const third = await syncWebPushToken("u1", "tok-b");
    expect(third.status).toBe("updated");
    expect(hoisted.mockRemoveFCMToken).toHaveBeenCalledWith("tok-a");
    expect(hoisted.mockSaveFCMToken).toHaveBeenCalledWith("u1", "tok-b");
  });

  it("unregisters cached web token on logout and clears cache", async () => {
    hoisted.mockSaveFCMToken.mockResolvedValue({ success: true });
    hoisted.mockRemoveFCMToken.mockResolvedValue({ success: true });
    hoisted.mockRemoveFCMToken.mockResolvedValue({ success: true });

    await syncWebPushToken("u1", "tok-logout");
    expect(readCachedWebToken()).toEqual({ userId: "u1", token: "tok-logout" });

    await unregisterWebPushToken(500);
    expect(hoisted.mockRemoveFCMToken).toHaveBeenCalledWith("tok-logout");
    expect(readCachedWebToken()).toBeNull();
  });

  it("resolves same-origin foreground links and rejects external origins", () => {
    expect(
      resolveForegroundLink({
        from: "sender",
        messageId: "m1",
        collapseKey: "",
        data: { url: "/dashboard/transcripts/abc" },
      }),
    ).toBe("/dashboard/transcripts/abc");

    expect(
      resolveForegroundLink({
        from: "sender",
        messageId: "m2",
        collapseKey: "",
        fcmOptions: { link: "https://evil.example/phish" },
      }),
    ).toBeUndefined();
  });

  it("preserves createdAt when updating an existing FCM token document", async () => {
    hoisted.mockDocGet.mockResolvedValue({ exists: true });
    hoisted.mockDocSet.mockResolvedValue(undefined);

    await saveFCMTokenFor("u1", "tok-1", "android");
    expect(hoisted.mockDocSet).toHaveBeenCalledWith(
      {
        userId: "u1",
        token: "tok-1",
        platform: "android",
        updatedAt: "SERVER_TS",
      },
      { merge: true },
    );
  });

  it("prioritizes relative data.url over prod fcmOptions.link on localhost/preview origins", () => {
    expect(
      resolveNotificationTargetUrl(
        {
          FCM_MSG: {
            fcmOptions: {
              link: "https://legaladviser.netbritz.com/dashboard/transcripts/s1",
            },
            data: { url: "/dashboard/transcripts/s1" },
          },
        },
        "http://localhost:3000",
      ),
    ).toBe("/dashboard/transcripts/s1");

    expect(
      resolveNotificationTargetUrl(
        { url: "https://evil.example/phish" },
        "http://localhost:3000",
      ),
    ).toBe("/notifications");
  });

  it("enforces self-only / admin auth on /api/notifications/single-push and multiple-push", async () => {
    hoisted.mockGetCurrentUser.mockResolvedValue({ id: "u1", role: "USER" });

    const forbiddenSingle = await singlePushRoute(
      new Request("http://localhost/api/notifications/single-push", {
        method: "POST",
        body: JSON.stringify({
          userId: "u2",
          title: "Hi",
          message: "Body",
          link: "/notifications",
        }),
      }),
    );
    expect(forbiddenSingle.status).toBe(403);

    const forbiddenMulti = await multiplePushRoute(
      new Request("http://localhost/api/notifications/multiple-push", {
        method: "POST",
        body: JSON.stringify({
          userIds: ["u1", "u2"],
          title: "Hi",
          message: "Body",
          link: "/notifications",
        }),
      }),
    );
    expect(forbiddenMulti.status).toBe(403);
  });

  it("notifies shared FCM state subscribers when token updates and clears token on unregister", async () => {
    const listener = vi.fn();
    const unsub = subscribeFcmClientState(listener);
    setFcmClientState({ permission: "granted", token: "shared-tok-1" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getFcmClientState().token).toBe("shared-tok-1");

    hoisted.mockRemoveFCMToken.mockResolvedValue({ success: true });
    await syncWebPushToken("u1", "shared-tok-1");
    await unregisterWebPushToken(500);
    expect(getFcmClientState().token).toBeNull();
    unsub();
  });

  it("prioritizes relative data.url over prod fcmOptions.link in resolveForegroundLink", () => {
    expect(
      resolveForegroundLink({
        from: "sender",
        messageId: "m-local",
        collapseKey: "",
        fcmOptions: {
          link: "https://legaladviser.netbritz.com/dashboard/transcripts/s1",
        },
        data: { url: "/dashboard/transcripts/s1" },
      }),
    ).toBe("/dashboard/transcripts/s1");
  });

  it("rate-limits non-admin callers on sendSingleNotification and /api/notifications/single-push", async () => {
    hoisted.mockGetCurrentUser.mockResolvedValue({ id: "u-rate", role: "USER" });
    hoisted.mockFetch.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({ success: true, message: "ok", sent: 1, failed: 0 }),
    });

    for (let i = 0; i < 20; i++) {
      const res = await sendSingleNotification({
        to: "u-rate",
        title: "Ping",
        message: "Body",
        link: "/notifications",
      });
      expect(res.success).toBe(true);
    }

    const blockedAction = await sendSingleNotification({
      to: "u-rate",
      title: "Ping",
      message: "Body",
      link: "/notifications",
    });
    expect(blockedAction.success).toBe(false);
    expect(blockedAction.message).toMatch(/Too many push requests/i);

    const blockedRoute = await singlePushRoute(
      new Request("http://localhost/api/notifications/single-push", {
        method: "POST",
        body: JSON.stringify({
          userId: "u-rate",
          title: "Ping",
          message: "Body",
          link: "/notifications",
        }),
      }),
    );
    expect(blockedRoute.status).toBe(429);
  });

  it("coalesces syncCurrentWebPushToken calls and aborts state mutation if sign-out happens while pending", async () => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    hoisted.mockSaveFCMToken.mockResolvedValue({ success: true });
    hoisted.mockRemoveFCMToken.mockResolvedValue({ success: true });

    let resolveToken: ((token: string) => void) | undefined;
    vi.mocked(getFCMToken).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveToken = resolve;
        }),
    );

    const p1 = syncCurrentWebPushToken("u-race");
    const p2 = syncCurrentWebPushToken("u-race");
    await unregisterWebPushToken(200);
    resolveToken?.("late-token");

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(getFcmClientState().token).toBeNull();
    expect(hoisted.mockSaveFCMToken).not.toHaveBeenCalled();
  });

  it("cleans up cached web token when permission is revoked to denied", async () => {
    hoisted.mockSaveFCMToken.mockResolvedValue({ success: true });
    hoisted.mockRemoveFCMToken.mockResolvedValue({ success: true });
    hoisted.mockRemoveFCMToken.mockResolvedValue({ success: true });

    await syncWebPushToken("u-revoked", "tok-revoked");
    setFcmClientState({ token: "tok-revoked", permission: "denied" });

    await cleanupRevokedWebPushToken("u-revoked");
    expect(hoisted.mockRemoveFCMToken).toHaveBeenCalledWith("tok-revoked");
    expect(readCachedWebToken()).toBeNull();
    expect(getFcmClientState().token).toBeNull();
  });
});
