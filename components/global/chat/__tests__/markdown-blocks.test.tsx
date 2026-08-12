import { describe, it, expect } from "vitest";
import { splitMarkdownBlocks, hasMath } from "../markdown-utils";

describe("splitMarkdownBlocks", () => {
  it("returns [] for empty input", () => {
    expect(splitMarkdownBlocks("")).toEqual([]);
  });

  it("keeps a single paragraph as one block", () => {
    expect(splitMarkdownBlocks("Hello world.")).toEqual(["Hello world."]);
  });

  it("splits two paragraphs separated by a blank line", () => {
    expect(splitMarkdownBlocks("Para one.\n\nPara two.")).toEqual([
      "Para one.",
      "Para two.",
    ]);
  });

  it("collapses multiple blank lines between paragraphs", () => {
    expect(splitMarkdownBlocks("A\n\n\n\nB")).toEqual(["A", "B"]);
  });

  it("trims leading and trailing blank lines", () => {
    expect(splitMarkdownBlocks("\n\nOnly.\n\n")).toEqual(["Only."]);
  });

  it("keeps a tight list as one block", () => {
    const md = "- a\n- b\n- c";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("keeps a loose (blank-separated) bullet list as one block", () => {
    const md = "- a\n\n- b";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("keeps a loose ordered list as one block", () => {
    const md = "1. first\n\n2. second\n\n3. third";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("keeps an indented multi-paragraph list item with its list", () => {
    const md = "- item a\n\n  continuation of a\n\n- item b";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("does not split inside a fenced code block that contains blank lines", () => {
    const md = "```js\nconst a = 1;\n\nconst b = 2;\n```";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("keeps a tilde-fenced code block intact", () => {
    const md = "~~~\nline1\n\nline2\n~~~";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("separates prose, code, and prose into three blocks", () => {
    const md = "text before\n\n```\ncode\n```\n\ntext after";
    expect(splitMarkdownBlocks(md)).toEqual([
      "text before",
      "```\ncode\n```",
      "text after",
    ]);
  });

  it("keeps a GFM table (no blank lines) as one block", () => {
    const md = "| a | b |\n| - | - |\n| 1 | 2 |";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  it("splits a heading from the following paragraph", () => {
    expect(splitMarkdownBlocks("# Title\n\nBody text.")).toEqual([
      "# Title",
      "Body text.",
    ]);
  });

  it("splits a heading from a following list but keeps the list whole", () => {
    expect(splitMarkdownBlocks("## Rights\n\n- a\n\n- b")).toEqual([
      "## Rights",
      "- a\n\n- b",
    ]);
  });

  it("treats a thematic break as its own block", () => {
    expect(splitMarkdownBlocks("above\n\n---\n\nbelow")).toEqual([
      "above",
      "---",
      "below",
    ]);
  });

  it("splits blockquotes separated by a real blank line (CommonMark)", () => {
    expect(splitMarkdownBlocks("> one\n\n> two")).toEqual(["> one", "> two"]);
  });

  it("keeps a blockquote with an internal '>' blank line intact", () => {
    const md = "> line one\n>\n> line two";
    expect(splitMarkdownBlocks(md)).toEqual([md]);
  });

  // --- Append-only stability: sealed blocks never change as the tail grows ---
  it("keeps sealed paragraph blocks byte-identical as the last block grows", () => {
    const a = splitMarkdownBlocks("Para one.\n\nPara two gro");
    const b = splitMarkdownBlocks("Para one.\n\nPara two growing.\n\nPara three");
    expect(a[0]).toBe("Para one.");
    expect(b[0]).toBe("Para one.");
    expect(a[0]).toBe(b[0]);
  });

  it("keeps a sealed prefix stable while a trailing list keeps merging", () => {
    const a = splitMarkdownBlocks("Intro.\n\n- item a\n\n- item b par");
    const b = splitMarkdownBlocks("Intro.\n\n- item a\n\n- item b partial\n\n- item c");
    expect(a[0]).toBe("Intro.");
    expect(a[0]).toBe(b[0]);
    // The list stays a single block in both snapshots (never fragments).
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
  });

  it("does not seal a trailing list item that ends on a blank line yet", () => {
    // Streaming paused right after a blank line following a list — the whole
    // list must remain the (single, growing) last block, not fragment.
    expect(splitMarkdownBlocks("- a\n\n")).toEqual(["- a"]);
    expect(splitMarkdownBlocks("- a\n\n- b")).toEqual(["- a\n\n- b"]);
  });
});

describe("hasMath", () => {
  it("is false for empty / plain prose", () => {
    expect(hasMath("")).toBe(false);
    expect(hasMath("Just some plain legal text.")).toBe(false);
  });

  it("detects inline $...$ math", () => {
    expect(hasMath("the value $x^2 + 1$ is positive")).toBe(true);
    expect(hasMath("$a$")).toBe(true);
  });

  it("detects display $$...$$ math", () => {
    expect(hasMath("$$E = mc^2$$")).toBe(true);
  });

  it("detects \\( \\) and \\[ \\] delimiters", () => {
    expect(hasMath("inline \\(a+b\\) here")).toBe(true);
    expect(hasMath("block \\[x=y\\] here")).toBe(true);
  });

  it("ignores single currency amounts", () => {
    expect(hasMath("the fee is $5")).toBe(false);
    expect(hasMath("costs about $1,200 total")).toBe(false);
  });

  it("ignores two separate currency amounts", () => {
    expect(hasMath("I paid $5 and got $3 back")).toBe(false);
  });
});
