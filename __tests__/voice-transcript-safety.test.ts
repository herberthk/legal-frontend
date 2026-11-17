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

  it.each([
    "👍",
    "a".repeat(9_998) + "🎉",
    "a".repeat(9_998) + "🎉" + "z",
  ])("preserves complete emoji pairs at the end of retained content", (content) => {
    expect(sanitizeVoiceTranscripts([{ role: "user", content }])[0]?.content)
      .toBe(content.slice(0, 10_000));
  });

  it("removes an unpaired trailing low surrogate", () => {
    expect(sanitizeVoiceTranscripts([{ role: "user", content: "hello\uDC4D" }]))
      .toEqual([{ role: "user", content: "hello" }]);
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
