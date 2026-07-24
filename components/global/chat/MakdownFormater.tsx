import React, { memo, useMemo } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type MarkdownFormatterProps = {
  content: string;
  role: "user" | "assistant" | "system" | "data";
  isStreaming?: boolean;
  isReasoning?: boolean;
};

// Define plugins outside the component to keep references stable
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

const MarkdownFormatter: React.FC<MarkdownFormatterProps> = ({ 
  content, 
  role, 
  isStreaming = false,
  isReasoning = false
}) => {
  // If streaming, append a special character that we'll render as the cursor
  const displayContent = isStreaming ? content + " ▋" : content;

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
        className={`text-xl font-bold mb-3 mt-4 ${
          role === "user" ? "text-white" : "text-slate-900 dark:text-white"
        }`}
        {...props}
      />
    ),
    h2: ({ ...props }) => (
      <h2
        className={`text-lg font-bold mb-2 mt-3 ${
          role === "user" ? "text-white" : "text-slate-900 dark:text-white"
        }`}
        {...props}
      />
    ),
    h3: ({ ...props }) => (
      <h3
        className={`text-base font-bold mb-2 mt-3 ${
          role === "user" ? "text-white" : "text-slate-900 dark:text-white"
        }`}
        {...props}
      />
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

  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={components}
    >
      {displayContent}
    </ReactMarkdown>
  );
};

export default memo(MarkdownFormatter);
