import { beforeEach, expect, it, vi } from "vitest";
import { recordUsageAndDeduct } from "@/lib/actions/usage";
const state = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>() }));
vi.mock("@/firebase/admin", () => ({ db: {
  collection: (name: string) => ({ doc: (id: string) => `${name}/${id}` }),
  runTransaction: async (callback: (tx: unknown) => unknown) => callback({
    get: async (ref: string) => ({ exists: state.docs.has(ref), data: () => state.docs.get(ref) }),
    set: (ref: string, data: Record<string, unknown>) => state.docs.set(ref, data),
    update: (ref: string, data: Record<string, unknown>) => state.docs.set(ref, { ...state.docs.get(ref), ...data }),
  }),
} }));
vi.mock("@/lib/actions/utils", () => ({ checkRootCollection: vi.fn() }));
beforeEach(() => { state.docs.clear(); state.docs.set("users/user", { welcomeTextTokens: 100 }); });
const charge = (sessionId: string) => recordUsageAndDeduct({ userId: "user", sessionId, idempotencyKey: "same-turn", type: "TEXT_RESPONSE", tokens: 10 });
it("deduplicates within a session and charges independently across sessions", async () => {
  expect(await charge("one")).toMatchObject({ success: true, alreadyCharged: false });
  expect(await charge("one")).toMatchObject({ success: true, alreadyCharged: true });
  expect(await charge("two")).toMatchObject({ success: true, alreadyCharged: false });
  expect(state.docs.get("users/user")?.welcomeTextTokens).toBe(80);
});
it("honors legacy charges only for their recorded session", async () => {
  state.docs.set("usage/user_same-turn", { sessionId: "one" });
  expect(await charge("one")).toMatchObject({ alreadyCharged: true });
  expect(await charge("two")).toMatchObject({ alreadyCharged: false });
});
