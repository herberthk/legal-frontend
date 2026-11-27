import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireMobileAuth = vi.fn();
const mockCheckRootCollection = vi.fn();

type StoredDoc = {
  id: string;
  userId: string;
  sessionId?: string;
  title?: string;
  summary?: string;
  transcripts?: { role: string; content: string }[];
  createdAt: Date;
};

let storedDocs: StoredDoc[] = [];
let lastLimitCalled: number | null = null;
let lastOffsetCalled: number | null = null;
let countCalled = false;

vi.mock("@/lib/api/v1/guard", () => ({
  requireMobileAuth: (...args: unknown[]) => mockRequireMobileAuth(...args),
}));

vi.mock("@/lib/actions/utils", () => ({
  checkRootCollection: (...args: unknown[]) => mockCheckRootCollection(...args),
}));

vi.mock("@/constants", () => ({
  COLLECTIONS: { VOICE_SESSIONS: "voiceSessions" },
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    fromDate: (date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    }),
  },
}));

vi.mock("@/firebase/admin", () => {
  const buildQuery = (
    filters: { field: string; op: string; val: unknown }[] = [],
    limitVal: number | null = null,
    offsetVal = 0,
    cursorId?: string,
  ) => {
    const runFilter = () => {
      return storedDocs
        .filter((doc) =>
          filters.every(({ field, op, val }) => {
            if (field === "userId" && op === "==") {
              return doc.userId === val;
            }
            if (field === "createdAt") {
              const targetMs = (val as { toMillis: () => number }).toMillis();
              const docMs = doc.createdAt.getTime();
              if (op === ">=") return docMs >= targetMs;
              if (op === "<=") return docMs <= targetMs;
            }
            return true;
          }),
        )
        .sort(
          (a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime() ||
            b.id.localeCompare(a.id),
        );
    };

    const toSnapshot = (docs: StoredDoc[]) => ({
      docs: docs.map((d) => ({
        id: d.id,
        data: () => ({
          ...d,
          createdAt: { toDate: () => d.createdAt },
        }),
      })),
    });

    return {
      where: (field: string, op: string, val: unknown) =>
        buildQuery([...filters, { field, op, val }], limitVal, offsetVal, cursorId),
      orderBy: () => buildQuery(filters, limitVal, offsetVal, cursorId),
      limit: (n: number) => {
        lastLimitCalled = n;
        return buildQuery(filters, n, offsetVal, cursorId);
      },
      offset: (n: number) => {
        lastOffsetCalled = n;
        return buildQuery(filters, limitVal, n, cursorId);
      },
      startAfter: (doc: { id: string }) =>
        buildQuery(filters, limitVal, offsetVal, doc.id),
      count: () => ({
        get: async () => {
          countCalled = true;
          return { data: () => ({ count: runFilter().length }) };
        },
      }),
      get: async () => {
        const matched = runFilter();
        const start =
          offsetVal +
          (cursorId === undefined
            ? 0
            : matched.findIndex((doc) => doc.id === cursorId) + 1);
        const sliced =
          limitVal === null
            ? matched.slice(start)
            : matched.slice(start, start + limitVal);
        return toSnapshot(sliced);
      },
    };
  };

  return {
    db: {
      collection: () => buildQuery(),
    },
  };
});

import { GET as getSessions } from "@/app/api/v1/voice/sessions/route";

beforeEach(() => {
  vi.clearAllMocks();
  storedDocs = [];
  lastLimitCalled = null;
  lastOffsetCalled = null;
  countCalled = false;
  mockRequireMobileAuth.mockResolvedValue({ userId: "user-1" });
  mockCheckRootCollection.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/v1/voice/sessions", () => {
  it("treats whitespace-only q as empty so Firestore limit/offset pagination is used", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T12:00:00.000Z"));

    storedDocs = Array.from({ length: 5 }, (_, index) => ({
      id: `sess-${index + 1}`,
      userId: "user-1",
      title: `Session ${index + 1}`,
      summary: "Summary",
      transcripts: [],
      createdAt: new Date(Date.now() - index * 60_000),
    }));

    const res = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?page=2&limit=2&filter=month&q=%20%20%20",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(countCalled).toBe(true);
    expect(lastLimitCalled).toBe(2);
    expect(lastOffsetCalled).toBe(2);
    expect(body.data.totalCount).toBe(5);
    expect(body.data.totalPages).toBe(3);
    expect(body.data.sessions.map((s: { id: string }) => s.id)).toEqual([
      "sess-3",
      "sess-4",
    ]);
  });

  it("matches multi-term and diacritic-insensitive queries across title, summary, sessionId, and transcript content", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T12:00:00.000Z"));

    const now = new Date();
    storedDocs = [
      {
        id: "s-transcript-match",
        sessionId: "call-991",
        userId: "user-1",
        title: "General Inquiry",
        summary: "Short overview",
        transcripts: [
          { role: "user", content: "Questions about café lease termination" },
          { role: "AI", content: "Under the Landlord and Tenant Act..." },
        ],
        createdAt: now,
      },
      {
        id: "s-sessionid-match",
        sessionId: "ug-land-774",
        userId: "user-1",
        title: "Other",
        summary: "Unrelated",
        transcripts: [],
        createdAt: new Date(now.getTime() - 1_000),
      },
    ];

    const res = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=month&q=cafe%20landlord",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.totalCount).toBe(1);
    expect(body.data.sessions[0].id).toBe("s-transcript-match");

    const byIdRes = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=month&q=ug-land-774",
      ),
    );
    const byIdBody = await byIdRes.json();
    expect(byIdBody.data.sessions.map((s: { id: string }) => s.id)).toEqual([
      "s-sessionid-match",
    ]);
  });

  it("paginates matching sessions and counts matches beyond the first batch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T12:00:00.000Z"));

    storedDocs = Array.from({ length: 252 }, (_, index) => ({
      id: `sess-${index}`,
      userId: "user-1",
      title: index === 0 || index >= 249 ? "Lease" : "Other",
      // Two matches on opposite sides of the batch boundary share a timestamp.
      createdAt: new Date(Date.now() - (index === 250 ? 249 : index) * 1_000),
    }));

    const res = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=month&q=lease&page=2&limit=2",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.totalCount).toBe(4);
    expect(body.data.totalPages).toBe(2);
    expect(body.data.sessions.map((s: { id: string }) => s.id)).toEqual([
      "sess-249",
      "sess-251",
    ]);
  });

  it("computes today and yesterday boundaries using the caller's tzOffset", async () => {
    vi.useFakeTimers();
    // 2026-11-27T22:30:00Z is already 2026-11-28 01:30 in Uganda (UTC+3, tzOffset = -180).
    vi.setSystemTime(new Date("2026-11-27T22:30:00.000Z"));

    storedDocs = [
      {
        id: "after-eat-midnight",
        userId: "user-1",
        title: "Late night call",
        createdAt: new Date("2026-11-27T21:15:00.000Z"), // 2026-11-28 00:15 EAT ("today" in EAT)
      },
      {
        id: "before-eat-midnight",
        userId: "user-1",
        title: "Earlier evening call",
        createdAt: new Date("2026-11-27T20:45:00.000Z"), // 2026-11-27 23:45 EAT ("yesterday" in EAT)
      },
    ];

    const todayEatRes = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=today&tzOffset=-180",
      ),
    );
    const todayEatBody = await todayEatRes.json();
    expect(todayEatBody.data.sessions.map((s: { id: string }) => s.id)).toEqual([
      "after-eat-midnight",
    ]);

    const yesterdayEatRes = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=yesterday&tzOffset=-180",
      ),
    );
    const yesterdayEatBody = await yesterdayEatRes.json();
    expect(
      yesterdayEatBody.data.sessions.map((s: { id: string }) => s.id),
    ).toEqual(["before-eat-midnight"]);
  });

  it("supports custom All Time as well as closed, one-sided, inverted, and invalid custom date bounds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T12:00:00.000Z"));

    storedDocs = [
      {
        id: "nov-05-eat",
        userId: "user-1",
        title: "Nov 5 EAT",
        createdAt: new Date("2026-11-05T10:00:00.000Z"),
      },
      {
        id: "nov-15-eat",
        userId: "user-1",
        title: "Nov 15 EAT",
        // 2026-11-14T22:00Z is 2026-11-15 01:00 EAT
        createdAt: new Date("2026-11-14T22:00:00.000Z"),
      },
      {
        id: "nov-25-eat",
        userId: "user-1",
        title: "Nov 25 EAT",
        createdAt: new Date("2026-11-25T10:00:00.000Z"),
      },
    ];

    // Closed range anchored to UTC+3 (tzOffset=-180)
    const closedRes = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=custom&start=2026-11-15&end=2026-11-20&tzOffset=-180",
      ),
    );
    const closedBody = await closedRes.json();
    expect(closedBody.data.sessions.map((s: { id: string }) => s.id)).toEqual([
      "nov-15-eat",
    ]);

    // Inverted start > end is normalized automatically
    const invertedRes = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=custom&start=2026-11-20&end=2026-11-15&tzOffset=-180",
      ),
    );
    const invertedBody = await invertedRes.json();
    expect(invertedBody.data.sessions.map((s: { id: string }) => s.id)).toEqual(
      ["nov-15-eat"],
    );

    // One-sided start only
    const startOnlyRes = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=custom&start=2026-11-15&tzOffset=-180",
      ),
    );
    const startOnlyBody = await startOnlyRes.json();
    expect(startOnlyBody.data.sessions.map((s: { id: string }) => s.id)).toEqual([
      "nov-25-eat",
      "nov-15-eat",
    ]);

    // One-sided end only
    const endOnlyRes = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=custom&end=2026-11-15&tzOffset=-180",
      ),
    );
    const endOnlyBody = await endOnlyRes.json();
    expect(endOnlyBody.data.sessions.map((s: { id: string }) => s.id)).toEqual([
      "nov-15-eat",
      "nov-05-eat",
    ]);

    // Plain All Time (no custom dates) + invalid calendar date + out-of-range years ignored -> full archive
    const allTimeRes = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=custom&start=2026-02-31&tzOffset=99999",
      ),
    );
    const allTimeBody = await allTimeRes.json();
    expect(allTimeBody.data.sessions.map((s: { id: string }) => s.id)).toEqual([
      "nov-25-eat",
      "nov-15-eat",
      "nov-05-eat",
    ]);

    const outOfRangeRes = await getSessions(
      new Request(
        "https://example.test/api/v1/voice/sessions?filter=custom&start=2200-01-01&end=1960-01-01",
      ),
    );
    const outOfRangeBody = await outOfRangeRes.json();
    expect(
      outOfRangeBody.data.sessions.map((s: { id: string }) => s.id),
    ).toEqual(["nov-25-eat", "nov-15-eat", "nov-05-eat"]);
  });
});
