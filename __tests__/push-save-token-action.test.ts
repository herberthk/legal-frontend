import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  mockVerifySessionCookie: vi.fn(),
  mockSaveFCMTokenFor: vi.fn(),
}));

vi.mock("@/firebase/admin", () => ({
  auth: { verifySessionCookie: hoisted.mockVerifySessionCookie },
  db: {},
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TS" },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "session" ? { value: "session-cookie" } : undefined,
  }),
}));

vi.mock("@/services/fcm", () => ({
  saveFCMTokenFor: hoisted.mockSaveFCMTokenFor,
  removeFCMTokenFor: vi.fn(),
}));

import { saveFCMToken } from "@/lib/actions/notifications";

describe("saveFCMToken server action", () => {
  beforeEach(() => {
    hoisted.mockVerifySessionCookie.mockReset();
    hoisted.mockSaveFCMTokenFor.mockReset();
  });

  it("persists token with platform 'web' for the authenticated session user", async () => {
    hoisted.mockVerifySessionCookie.mockResolvedValue({ uid: "web-user-1" });
    hoisted.mockSaveFCMTokenFor.mockResolvedValue({ success: true });

    const res = await saveFCMToken("ignored-client-uid", "web-tok-123");

    expect(res).toEqual({ success: true });
    expect(hoisted.mockSaveFCMTokenFor).toHaveBeenCalledWith(
      "web-user-1",
      "web-tok-123",
      "web",
    );
  });
});
