/**
 * Pure markdown helpers for incremental, memoized streaming render.
 *
 * These are intentionally free of any React / react-markdown imports so the
 * unit tests can exercise them without pulling the whole rendering stack.
 */

const FENCE_OPEN = /^\s*(`{3,}|~{3,})/;
const LIST_ITEM = /^\s{0,3}([-*+]|\d+[.)])\s/;
const BLOCKQUOTE = /^\s{0,3}>/;
const INDENTED = /^( {2,}|\t)/;

const isBlank = (line: string): boolean => line.trim() === "";

/**
 * Split markdown into top-level blocks for incremental, memoized rendering.
 *
 * Guarantees that matter for streaming:
 *  - Never splits inside a fenced code block (``` or ~~~), so code that
 *    contains blank lines stays in one block.
 *  - Never splits a loose list (items separated by blank lines) or an indented
 *    continuation — these render correctly only when kept together.
 *  - Append-only stability: as `content` grows during streaming, every block
 *    except the last stays byte-identical, so memoized blocks never re-parse.
 *    A blank line definitively ends a paragraph in Markdown; a list boundary
 *    only "solidifies" once the following non-continuation line arrives, and
 *    until then the ambiguous tail is kept in the (re-parsing) last block.
 *
 * Rendering each returned block independently through the same react-markdown
 * component map is visually identical to rendering the whole string, for every
 * construct these answers use (paragraphs, headings, lists, tables, code,
 * blockquotes, thematic breaks).
 */
export function splitMarkdownBlocks(content: string): string[] {
  if (!content) return [];

  const lines = content.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  const firstNonBlank = (): string | undefined =>
    current.find((l) => !isBlank(l));

  const flush = () => {
    // Drop trailing blank separator lines; keep the block's own content.
    while (current.length > 0 && isBlank(current[current.length - 1])) {
      current.pop();
    }
    if (current.length > 0) blocks.push(current.join("\n"));
    current = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // --- Fenced code tracking (never split inside a fence) ---
    if (!inFence) {
      const open = line.match(FENCE_OPEN);
      if (open) {
        inFence = true;
        fenceChar = open[1][0]; // "`" or "~"
        fenceLength = open[1].length;
        current.push(line);
        continue;
      }
    } else {
      current.push(line);
      // CommonMark: a fence closes only on a run of the same character at least
      // as long as the opening fence. A shorter run (e.g. 3 backticks under a
      // 4-backtick opener) is fenced content, not a closer. The closing line must
      // have 0-3 leading spaces (no tabs, no 4+ spaces), otherwise it's indented
      // content that stays inside the fence.
      const indentMatch = line.match(/^( {0,3})(?=\S|$)/);
      if (!indentMatch) {
        // Line starts with tab or 4+ spaces — fenced content, not a closer.
        continue;
      }
      const t = line.trim();
      const isFenceRun = /^`{3,}$/.test(t) || /^~{3,}$/.test(t);
      const closes =
        isFenceRun && t.charAt(0) === fenceChar && t.length >= fenceLength;
      if (closes) {
        inFence = false;
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }

    if (!isBlank(line)) {
      current.push(line);
      continue;
    }

    // Blank line, outside any fence. Look ahead to the next non-blank line to
    // decide whether this blank is a real block boundary.
    let j = i + 1;
    while (j < lines.length && isBlank(lines[j])) j++;

    if (j >= lines.length) {
      // Only trailing blanks remain — no new block has started yet. Keep
      // everything in `current` as the growing tail (append-only stability).
      current.push(line);
      continue;
    }

    const next = lines[j];
    const first = firstNonBlank();
    const currentIsList = first !== undefined && LIST_ITEM.test(first);
    const currentIsQuote = first !== undefined && BLOCKQUOTE.test(first);

    // A blank line does NOT end the block when the following line continues it:
    //  - inside a list: the next line is another list item, or indented
    //    sub-content (loose list / multi-paragraph list item)
    //  - a lazily-indented continuation of the current block
    // Blockquotes intentionally split on a true blank line (CommonMark ends a
    // blockquote there); internal ">" blank lines are non-blank so stay intact.
    const isContinuation =
      (currentIsList && (LIST_ITEM.test(next) || INDENTED.test(next))) ||
      (!currentIsQuote && INDENTED.test(next));

    if (isContinuation) {
      current.push(line);
      continue;
    }

    // Real boundary: seal the current block and skip the separator blanks.
    flush();
    i = j - 1;
  }

  flush();
  return blocks;
}

/**
 * Cheap detector for whether a block contains math that remark-math/KaTeX
 * should process, so we can skip those plugins on the (common) blocks with no
 * math at all.
 *
 * Biased to avoid false negatives on real math while ignoring plain currency:
 *  - `$$…$$` display math, and `\(` / `\[` LaTeX delimiters → always true.
 *  - inline `$…$` requires a non-space just inside each delimiter, so "$5" and
 *    "$5 and $10" (currency) are ignored but "$x^2$" matches.
 */
export function hasMath(s: string): boolean {
  if (!s) return false;
  if (s.includes("$$") || s.includes("\\[") || s.includes("\\(")) return true;
  if (s.indexOf("$") === -1) return false;
  return /\$(?=\S)[^$\n]*?\S\$/.test(s);
}

/**
 * Detect GFM reference-style link definitions (`[id]: url`) anywhere in a
 * document. Such a definition is a formatting reference that other blocks
 * (separated by blank lines) depend on, but splitting the document into
 * independently-parsed blocks loses that document-scoped state — the
 * definition must be rendered in the same ReactMarkdown parse as its usages.
 *
 * Conservative match: a line like `[label]: url` / `[label]: <url>` at the
 * start of a line (up to 3 leading spaces, per CommonMark). Deliberately does
 * not match footnote definitions (`[^id]:`), since footnotes aren't rendered
 * here anyway.
 */
export function hasReferenceDefinitions(s: string): boolean {
  if (!s) return false;
  return /(?:^|\n)\s{0,3}\[(?!\^)[^\]\n]+\]:\s*\S/.test(s);
}
