import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { getTranscriptions } from "@/lib/actions/transcribe";
import { TranscriptionHistory } from "@/components/user/transcribe/TranscriptionHistory";

vi.mock("@/lib/actions/transcribe", () => ({
  getTranscriptions: vi.fn(),
  deleteTranscriptionRecord: vi.fn(),
  saveTranscriptionRecord: vi.fn(),
}));

vi.mock("@/components/editor/PDFDocument", () => ({ PDFDocument: () => null }));
vi.mock("@/components/user/transcribe/TranscriptionCard", () => ({
  TranscriptionCard: ({ record }: { record: TranscriptionRecord }) => <p>{record.title}</p>,
}));
vi.mock("@/components/user/transcribe/TranscriptionFilters", () => ({
  TranscriptionFilters: ({ setSearchQuery }: { setSearchQuery: (value: string) => void }) => (
    <input aria-label="Search" onChange={(event) => setSearchQuery(event.target.value)} />
  ),
}));

it("loads more search results using the server cursor when no rows were displayed", async () => {
  vi.mocked(getTranscriptions)
    .mockResolvedValueOnce({ success: true, transcriptions: [], hasMore: false })
    .mockResolvedValueOnce({
      success: true, transcriptions: [], hasMore: true, nextCursorId: "last-scanned",
    })
    .mockResolvedValueOnce({
      success: true,
      transcriptions: [{
        id: "match",
        title: "Lease agreement",
        fileName: "lease.pdf",
        transcribedText: "",
        userId: "user-1",
        formatMode: "professional",
        createdAt: "2026-10-01T10:00:00Z",
        updatedAt: "2026-10-01T10:00:00Z",
      }],
      hasMore: false,
    });

  render(<TranscriptionHistory onNewTranscription={vi.fn()} onViewTranscription={vi.fn()} />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Search" }), {
    target: { value: "lease" },
  });

  fireEvent.click(await screen.findByRole("button", { name: "Load More" }));

  expect(getTranscriptions).toHaveBeenLastCalledWith(10, "last-scanned", "lease", "all");
  expect(await screen.findByText("Lease agreement")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Load More" })).toBeNull();
});
