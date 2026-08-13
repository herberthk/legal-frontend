import React, { memo, useMemo } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { splitMarkdownBlocks, hasMath, hasReferenceDefinitionsOrFootnotes } from "./markdown-utils";
// import "katex/dist/katex.min.css";

type MarkdownFormatterProps = {
  content: string;
  role: "user" | "assistant" | "system" | "data";
  isStreaming?: boolean;
  isReasoning?: boolean;
};

// Stable plugin references, chosen per-block. remark-gfm is always on
// (tables/strikethrough are common in legal answers). remark-math + rehype-katex
// run ONLY on blocks that actually contain math delimiters (see hasMath), so the
// common no-math block skips the KaTeX pipeline entirely. trust:false disables
// unsafe LaTeX commands like \href, \includegraphics; strict:false suppresses
// warnings for unsupported LaTeX.
const REMARK_GFM_ONLY = [remarkGfm];
const REMARK_WITH_MATH = [remarkGfm, remarkMath];
const REHYPE_WITH_MATH: [typeof rehypeKatex, Record<string, unknown>][] = [
  [rehypeKatex, { trust: false, strict: false }],
];
const REHYPE_NONE: never[] = [];

type MarkdownBlockProps = {
  content: string;
  showCaret: boolean;
  components: Components;
};

// A single top-level markdown block. Wrapped in memo so that, during streaming,
// only the last (growing) block re-parses — every sealed block above it keeps a
// byte-identical `content` string and a stable `components` ref, so React skips
// it entirely. This is the fix for the O(n²) whole-message re-parse that made
// long answers feel janky.
const MarkdownBlock = memo(function MarkdownBlock({
  content,
  showCaret,
  components,
}: MarkdownBlockProps) {
  const applyMath = hasMath(content);
  // The caret marker is injected only into the last block's string, so every
  // sealed block stays byte-identical (and memoized). The <p> renderer swaps
  // the marker for the animated dot.
  const displayContent = showCaret ? content + " ▋" : content;

  return (
    <ReactMarkdown
      remarkPlugins={applyMath ? REMARK_WITH_MATH : REMARK_GFM_ONLY}
      rehypePlugins={applyMath ? REHYPE_WITH_MATH : REHYPE_NONE}
      components={components}
    >
      {displayContent}
    </ReactMarkdown>
  );
});

const MarkdownFormatter: React.FC<MarkdownFormatterProps> = ({
  content,
  role,
  isStreaming = false,
  isReasoning = false,
}) => {
  // Detect if content uses reference-style links or footnotes, which require
  // document-wide scope and break if split across blocks.
  const usesScopedFeatures = useMemo(
    () => hasReferenceDefinitionsOrFootnotes(content),
    [content]
  );

  // Memoize the components map to avoid recreating it on every render,
  // which causes ReactMarkdown to teardown and rebuild the virtual DOM.
  const components: Components = useMemo(() => ({
    p: ({ children, ...props }) => {
      // Check if children contains our cursor marker
      const childrenArray = React.Children.toArray(children);
      const hasCursor = childrenArray.some(child =>
        typeof child === 'string' && child.includes('▋')
      );

      if (hasCursor) {
        // Replace the marker with our animated cursor UI
        const newChildren = childrenArray.map((child, index) => {
          if (typeof child === 'string' && child.includes('▋')) {
            const parts = child.split('▋');
            return (
              <React.Fragment key={index}>
                {parts[0]}
                <span className="inline-block w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-pulse ml-0.5 align-[1px]" />
                {parts[1]}
              </React.Fragment>
            );
          }
          return child;
        });
        return <p className={`mb-2 last:mb-0 min-h-[1.5em] ${isReasoning ? 'mb-0' : ''}`} {...props}>{newChildren}</p>;
      }

      return <p className={`mb-2 last:mb-0 min-h-[1.5em] ${isReasoning ? 'mb-0' : ''}`} {...props}>{children}</p>;
    },
    a: ({ ...props }) => (
      <a
        className={`underline decoration-1 underline-offset-2 transition-colors font-medium ${
          role === "user"
            ? "text-white decoration-white/50 hover:decoration-white"
            : "text-orange-600 dark:text-orange-400 decoration-orange-600/30 dark:decoration-orange-400/30 hover:decoration-orange-600 dark:hover:decoration-orange-400"
        }`}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
    strong: ({ children, ...props }) => (
        <strong className="font-bold dark:text-white text-slate-900" {...props}>
          {children}
        </strong>
    ),
    em: ({ children, ...props }) => (
        <em className="italic text-indigo-600 dark:text-indigo-400" {...props}>
          {children}
        </em>
    ),
    code: ({
      className,
      children,
      ...props
    }) => {
      const match = /language-(\w+)/.exec(className || "");
      const isInline = !match && !String(children).includes("\n");

      return isInline ? (
        <code
          className={`px-1.5 py-0.5 rounded font-mono text-xs ${
            role === "user"
              ? "bg-black/20 text-white border border-white/10"
              : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
          }`}
          {...props}
        >
          {children}
        </code>
      ) : (
        <div
          className={`rounded-lg overflow-hidden my-3 border ${
            role === "user"
              ? "bg-black/20 border-white/10 text-white"
              : "bg-slate-900 border-slate-700 text-slate-200"
          }`}
        >
          <div
            className={`px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border-b flex items-center justify-between ${
              role === "user"
                ? "border-white/10 bg-white/5"
                : "border-slate-700 bg-slate-950"
            }`}
          >
            <span>{match ? match[1] : "code"}</span>
          </div>
          <div className="overflow-x-auto">
            <pre className="p-3 text-xs font-mono leading-relaxed bg-transparent m-0">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        </div>
      );
    },
    blockquote: ({ ...props }) => (
      <blockquote
        className={`border-l-4 pl-4 py-1 my-4 italic ${
          role === "user"
            ? "border-white/40 text-white/90 bg-white/5 rounded-r-lg"
            : "border-orange-500/50 text-slate-600 dark:text-slate-400 bg-orange-50/50 dark:bg-orange-900/10 rounded-r-lg"
        }`}
        {...props}
      />
    ),
    ul: ({ ...props }) => (
      <ul
        className={`list-disc pl-5 my-2 space-y-1 ${
          role === "user"
            ? "marker:text-white/70"
            : "marker:text-orange-500"
        }`}
        {...props}
      />
    ),
    ol: ({ ...props }) => (
      <ol
        className={`list-decimal pl-5 my-2 space-y-1 ${
          role === "user"
            ? "marker:text-white/70"
            : "marker:text-orange-500"
        }`}
        {...props}
      />
    ),
    li: ({ ...props }) => (
      <li className="pl-1" {...props} />
    ),
    h1: ({ ...props }) => (
      <h1
        className={`text-lg md:text-xl font-bold mb-3 mt-4 ${
          role === "user" ? "text-white" : "text-slate-900 dark:text-white"
        }`}
        {...props}
      />
    ),
    h2: ({ ...props }) => (
      <h2
        className={`md:text-lg text-base font-bold mb-2 mt-3 ${
          role === "user" ? "text-white" : "text-slate-900 dark:text-white"
        }`}
        {...props}
      />
    ),
    h3: ({ ...props }) => (
      <h3
        className={`text-base md:text-lg font-bold mb-2 mt-3 ${
          role === "user" ? "text-white" : "text-slate-900 dark:text-white"
        }`}
        {...props}
      />
    ),
    h4: ({ children, ...props }) => (
        <h4
          className="text-base md:text-xl font-bold text-indigo-300 mb-3 mt-6"
          {...props}
        >
          {children}
        </h4>
      ),
    hr: ({ ...props }) => (
      <hr className="my-4 border-t border-slate-600/60! dark:border-slate-300/60!" {...props} />
    ),
    table: ({ ...props }) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-opacity-20 overflow-hidden shadow-sm">
        <table
          className={`min-w-full divide-y ${
            role === "user"
              ? "divide-white/20 border-white/20"
              : "divide-slate-200 dark:divide-slate-700 border-slate-200 dark:border-slate-700"
          }`}
          {...props}
        />
      </div>
    ),
    thead: ({ ...props }) => (
      <thead
        className={
          role === "user"
            ? "bg-white/10"
            : "bg-slate-50 dark:bg-slate-800"
        }
        {...props}
      />
    ),
    th: ({ ...props }) => (
      <th
        className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
          role === "user"
            ? "text-white/90"
            : "text-slate-500 dark:text-slate-400"
        }`}
        {...props}
      />
    ),
    tbody: ({ ...props }) => (
      <tbody
        className={`divide-y ${
          role === "user"
            ? "divide-white/10"
            : "divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900"
        }`}
        {...props}
      />
    ),
    tr: ({ ...props }) => (
      <tr
        className={
          role === "user"
            ? "hover:bg-white/5 transition-colors"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        }
        {...props}
      />
    ),
    td: ({ ...props }) => (
      <td
        className={`px-4 py-2.5 text-sm whitespace-pre-wrap ${
          role === "user"
            ? "text-white"
            : "text-slate-600 dark:text-slate-300"
        }`}
        {...props}
      />
    ),
  }), [role, isReasoning]);

  // Split into top-level blocks so sealed blocks memoize and only the growing
  // tail re-parses. Cheap O(n) line scan — and with the client render throttle
  // this runs ~25×/sec, not per token.
  // EXCEPTION: bypass splitting when the document uses reference-style links
  // or footnotes, which require document-wide scope (the definition can be in
  // a different block than the usage). In that case, render as a single block.
  const blocks = useMemo(
    () => (usesScopedFeatures ? [content] : splitMarkdownBlocks(content)),
    [content, usesScopedFeatures]
  );

  // Nothing yet: show a lone caret while streaming (matches prior behavior when
  // the first token hasn't arrived), otherwise render nothing.
  if (blocks.length === 0) {
    return isStreaming ? (
      <MarkdownBlock content="" showCaret components={components} />
    ) : null;
  }

  const lastIndex = blocks.length - 1;
  return (
    <>
      {blocks.map((block, i) => (
        <MarkdownBlock
          key={i}
          content={block}
          showCaret={isStreaming && i === lastIndex}
          components={components}
        />
      ))}
    </>
  );
};

export default memo(MarkdownFormatter);
