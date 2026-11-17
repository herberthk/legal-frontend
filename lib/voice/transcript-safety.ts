export type SafeVoiceTranscript = {
  role: "user" | "AI";
  content: string;
};

const MAX_TRANSCRIPT_ENTRIES = 1_000;
const MAX_TRANSCRIPT_CONTENT_CHARS = 10_000;
const MAX_TRANSCRIPT_TOTAL_CHARS = 300_000;
const MAX_BUFFER_USER_NAME_CHARS = 120;
const MAX_BUFFER_DURATION_SECONDS = 1_800;

/** Bounds untrusted client/Firestore transcript data before AI or persistence. */
export function sanitizeVoiceTranscripts(
  value: unknown,
): SafeVoiceTranscript[] {
  if (!Array.isArray(value)) return [];
  const result: SafeVoiceTranscript[] = [];
  let totalChars = 0;

  for (const candidate of value) {
    if (result.length >= MAX_TRANSCRIPT_ENTRIES) break;
    if (typeof candidate !== "object" || candidate === null) continue;
    const role = (candidate as { role?: unknown }).role;
    const rawContent = (candidate as { content?: unknown }).content;
    if ((role !== "user" && role !== "AI") || typeof rawContent !== "string") {
      continue;
    }
    const remaining = MAX_TRANSCRIPT_TOTAL_CHARS - totalChars;
    if (remaining <= 0) break;
    let content = rawContent.slice(
      0,
      Math.min(MAX_TRANSCRIPT_CONTENT_CHARS, remaining),
    );
    // If sliced through a UTF-16 surrogate pair, drop the dangling surrogate.
    // JS slice can leave either a lone high surrogate (0xD800–0xDBFF) when the
    // cut falls before the low surrogate, or a lone low surrogate (0xDC00–0xDFFF)
    // when the cut falls before the high surrogate was consumed. Both are invalid
    // Unicode scalar values and must be removed.
    const lastCode = content.charCodeAt(content.length - 1);
    if (
      (lastCode >= 0xd800 && lastCode <= 0xdbff) ||
      (lastCode >= 0xdc00 && lastCode <= 0xdfff)
    ) {
      content = content.slice(0, -1);
    }
    if (!content.trim()) continue;
    result.push({ role, content });
    totalChars += content.length;
  }
  return result;
}

type VoiceBufferIdentity = {
  sessionId: string;
  userId: string;
  userName?: string;
  preferedVoice?: {
    preferedVoiceId?: string;
    preferedVoiceName?: string;
  };
  duration: number;
  /** `serverTimestamp()` from the caller; kept out of this pure module. */
  updatedAt: unknown;
};

function bufferIdentity(input: VoiceBufferIdentity) {
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    // The rule caps this at 120 characters, so a long or missing display name must
    // not make every buffer write fail validation.
    userName: (input.userName ?? "").slice(0, MAX_BUFFER_USER_NAME_CHARS),
    preferedVoice: input.preferedVoice ?? {},
    duration: Math.max(
      0,
      Math.min(
        MAX_BUFFER_DURATION_SECONDS,
        Number.isFinite(input.duration) ? Math.floor(input.duration) : 0,
      ),
    ),
  };
}

/**
 * The transcript/heartbeat buffer payload, shaped to pass `isValidVoiceBuffer`.
 *
 * A `merge` write is used, so this includes every rule-required key. The list is
 * sanitised here, not just at the caller: the rule rejects a buffer with more
 * than 1,000 entries, and a rejected write silently kills the heartbeat that
 * keeps a live call from being finalised as abandoned.
 */
export function buildBufferPayload(
  input: VoiceBufferIdentity & { transcripts: SafeVoiceTranscript[] },
) {
  return {
    ...bufferIdentity(input),
    transcripts: sanitizeVoiceTranscripts(input.transcripts),
    updatedAt: input.updatedAt,
    status: "active" as const,
  };
}

/**
 * The liveness-only payload.
 *
 * It deliberately omits `transcripts`: with a `merge` write, sending an empty
 * array would erase the transcript batches already committed. The rules accept a
 * buffer without `transcripts`, and the server re-sanitises whatever is there.
 */
export function buildHeartbeatPayload(input: VoiceBufferIdentity) {
  return {
    ...bufferIdentity(input),
    updatedAt: input.updatedAt,
    status: "active" as const,
  };
}
