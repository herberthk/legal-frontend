import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MarkdownFormatter from "../MakdownFormater";

describe("MarkdownFormatter", () => {
  it("renders a reference-style link whose definition precedes usage across a blank line", () => {
    render(
      <MarkdownFormatter
        content={'See [the docs][1].\n\n[1]: https://example.com'}
        role="assistant"
      />
    );

    // The definition must resolve in the same parse scope as its usage, so the
    // reference renders as a clickable link rather than literal "[the docs][1]".
    const link = screen.getByRole("link", { name: "the docs" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(screen.queryByText("[the docs][1]")).toBeNull();
  });

  it("renders an inline link normally", () => {
    render(
      <MarkdownFormatter
        content="See [the docs](https://example.com) here."
        role="assistant"
      />
    );
    const link = screen.getByRole("link", { name: "the docs" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://example.com");
  });

  it("renders a reference-style link whose definition follows its usage while streaming", () => {
    // When streaming, the definition lands as the final line with no trailing
    // newline. The reference-definition branch must close it with two trailing
    // newlines so the reference still resolves as a link rather than leaking
    // literal text (such as the caret marker) into the rendered output.
    render(
      <MarkdownFormatter
        content={'See [the docs][1].\n\n[1]: https://example.com'}
        role="assistant"
        isStreaming
      />
    );

    const link = screen.getByRole("link", { name: "the docs" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(screen.queryByText("[the docs][1]")).toBeNull();
  });
});