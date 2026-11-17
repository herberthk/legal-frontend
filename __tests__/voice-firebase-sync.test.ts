import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useFirebaseSync } from "@/hooks/use-gemini-live/use-firebase-sync";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})), getDoc: vi.fn(), setDoc: vi.fn(),
  updateDoc: vi.fn(), serverTimestamp: vi.fn(() => "timestamp"),
}));
const turn = { role: "user" as const, content: "Yes" };
function setup(pending = [turn]) {
  const allTranscriptsRef = { current: pending };
  const hook = renderHook(() => useFirebaseSync({
    sessionIdRef: { current: "session" }, userId: "user", userName: "Name",
    preferedVoice: {} as PreferedVoice, allTranscriptsRef,
  }));
  return { ...hook, allTranscriptsRef };
}
beforeEach(() => vi.resetAllMocks());
describe("voice transcript persistence", () => {
  it.each([false, true])("bounds the entire write (existing document: %s)", async (exists) => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => exists,
      data: () => ({ transcripts: Array(999).fill(turn) }),
    } as never);
    const { result, allTranscriptsRef } = setup(Array(1001).fill(turn));
    await act(() => result.current.syncSessionToBuffer(10));
    const write = exists ? vi.mocked(updateDoc) : vi.mocked(setDoc);
    expect(write.mock.calls[0][1]).toHaveProperty("transcripts", Array(1000).fill(turn));
    expect(allTranscriptsRef.current).toEqual([]);
  });
  it("preserves repeated stored and pending turns within the limit", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true,
      data: () => ({ transcripts: [turn] }),
    } as never);
    const { result } = setup();
    await act(() => result.current.syncSessionToBuffer(10));
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ transcripts: [turn, turn] }));
  });
  it("keeps heartbeat live during repeated failed transcript writes and retains pending turns", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({}) } as never);
    vi.mocked(updateDoc).mockRejectedValue(new Error("rejected"));
    const { result, allTranscriptsRef } = setup();
    for (const duration of [10, 20]) {
      await act(async () => {
        const sync = result.current.syncSessionToBuffer(duration);
        await result.current.heartbeatBuffer(duration);
        await sync;
      });
      expect(result.current.isSyncingRef.current).toBe(false);
    }
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(vi.mocked(setDoc).mock.calls[0][1]).not.toHaveProperty("transcripts");
    expect(allTranscriptsRef.current).toEqual([turn]);
    vi.restoreAllMocks();
  });
});
