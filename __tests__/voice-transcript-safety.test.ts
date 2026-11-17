import { describe, expect, it } from "vitest";

import {
  buildBufferPayload,
  buildHeartbeatPayload,
  sanitizeVoiceTranscripts,
} from "@/lib/voice/transcript-safety";

describe("voice transcript buffer boundary", () => {
  it("preserves repeated valid turns and rejects malformed roles", () => {
    expect(
      sanitizeVoiceTranscripts([
        { role: "user", content: "Yes" },
        { role: "user", content: "Yes" },
        { role: "assistant", content: "invalid role" },
        { role: "AI", content: "" },
      ]),
    ).toEqual([
      { role: "user", content: "Yes" },
      { role: "user", content: "Yes" },
    ]);
  });

  it("caps individual and aggregate content before summarization", () => {
    const entries = Array.from({ length: 40 }, () => ({
      role: "AI" as const,
      content: "x".repeat(10_001),
    }));
    const sanitized = sanitizeVoiceTranscripts(entries);
    expect(sanitized).toHaveLength(30);
    expect(sanitized[0]?.content).toHaveLength(10_000);
    expect(
      sanitized.reduce((total, entry) => total + entry.content.length, 0),
    ).toBe(300_000);
  });

  it("drops trailing high surrogate if sliced mid surrogate pair", () => {
    const longTextWithEmoji = "a".repeat(9_999) + "\uD83D\uDC4D";
    const sanitized = sanitizeVoiceTranscripts([
      { role: "user", content: longTextWithEmoji },
    ]);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.content).toHaveLength(9_999);
    expect(sanitized[0]?.content.endsWith("a")).toBe(true);
  });

  it("drops trailing low surrogate if the slice lands on the second half of a pair", () => {
    // Build a string whose 10_001st code unit is the LOW surrogate of 🎉 (U+1F389).
    // 🎉 encodes as [0xD83C, 0xDF89]. Place 9_999 "a"s then the emoji:
    //   index 9999 → 0xD83C (high), index 10000 → 0xDF89 (low)
    // slice(0, 10_000) gives 9_999 "a"s + the high surrogate → that path is
    // covered by the previous test.
    //
    // To hit the LOW surrogate path: slice must end exactly on the low surrogate.
    // Put 9_998 "a"s + the full emoji (2 code units) + one more "a" = 10_001 chars.
    // slice(0, 10_000) = 9_998 "a"s + 0xD83C (high) + 0xDF89 (low) — but that's
    // only 10_000 chars; the last code unit is the LOW surrogate (0xDF89).
    // Wait — slice(0, 10_000) on 9_998 "a"s + emoji:
    //   positions: 0..9997 = "a", 9998 = 0xD83C, 9999 = 0xDF89 → length 10_000
    // The slice boundary coincides exactly with the full emoji — no dangling.
    // To force the low-surrogate case: insert the emoji so its HIGH surrogate is
    // at position 9_999 and LOW at 10_000, then add a trailing char so the total
    // exceeds 10_000 and the slice cuts at 10_000 (the low surrogate).
    //   9_999 "a"s + 🎉 (2 units) + "z" = 10_002 chars
    //   slice(0, 10_000) = 9_999 "a"s + 0xD83C (high at 9999) + 0xDF89 (low at 10000)
    //   → the last code unit is 0xDF89, a LOW surrogate (0xDC00–0xDFFF)
    const lowSurrogateAtBoundary =
      "a".repeat(9_999) + "\uD83C\uDF89" + "z";
    const sanitized = sanitizeVoiceTranscripts([
      { role: "user", content: lowSurrogateAtBoundary },
    ]);
    expect(sanitized).toHaveLength(1);
    // Both the high and low surrogate must be stripped (the whole emoji is gone)
    expect(sanitized[0]?.content).toHaveLength(9_999);
    expect(sanitized[0]?.content.endsWith("a")).toBe(true);
    // No dangling surrogates
    const lastCode = sanitized[0]!.content.charCodeAt(
      sanitized[0]!.content.length - 1,
    );
    expect(lastCode < 0xd800 || lastCode > 0xdfff).toBe(true);
  });
});

describe("voice buffer payloads match the deployed rules", () => {
  const identity = {
    sessionId: "session-1",
    userId: "user-1",
    userName: "A".repeat(200),
    duration: 1_900.7,
    updatedAt: "sentinel",
  };

  it("sends every required key and the transcript batch", () => {
    const payload = buildBufferPayload({
      ...identity,
      transcripts: [{ role: "user", content: "Hello" }],
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        "duration",
        "preferedVoice",
        "sessionId",
        "status",
        "transcripts",
        "updatedAt",
        "userId",
        "userName",
      ].sort(),
    );
    expect(payload.userName).toHaveLength(120);
    expect(payload.duration).toBe(1_800);
    expect(payload.status).toBe("active");
    expect(payload.transcripts).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("keeps the heartbeat free of transcripts and defaults the voice", () => {
    const payload = buildHeartbeatPayload(identity);
    expect(payload).not.toHaveProperty("transcripts");
    expect(payload.preferedVoice).toEqual({});
    expect(Object.keys(payload).sort()).toEqual(
      [
        "duration",
        "preferedVoice",
        "sessionId",
        "status",
        "updatedAt",
        "userId",
        "userName",
      ].sort(),
    );
  });

  it("caps the transcript list at the rule limit", () => {
    const entries = Array.from({ length: 1_200 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("AI" as const),
      content: `turn ${index}`,
    }));
    const payload = buildBufferPayload({ ...identity, transcripts: entries });
    expect(payload.transcripts).toHaveLength(1_000);
    expect(payload.transcripts[999]).toEqual({
      role: "AI",
      content: "turn 999",
    });
  });

  it("drops invalid transcript entries instead of failing the rule", () => {
    const payload = buildBufferPayload({
      ...identity,
      transcripts: [
        { role: "assistant", content: "not a voice role" },
        { role: "user", content: "  " },
        { role: "AI", content: "kept" },
      ] as unknown as Parameters<typeof buildBufferPayload>[0]["transcripts"],
    });
    expect(payload.transcripts).toEqual([{ role: "AI", content: "kept" }]);
  });

  it("normalises a missing name and a non-finite duration", () => {
    const payload = buildHeartbeatPayload({
      ...identity,
      userName: undefined,
      duration: Number.NaN,
    });
    expect(payload.userName).toBe("");
    expect(payload.duration).toBe(0);
  });
});
