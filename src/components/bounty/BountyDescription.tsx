import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Matches the design tokens already used for description text elsewhere in
// this app (see the plain <p> this component replaces on IssueDetailPage).
const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="leading-relaxed text-slate-600 dark:text-slate-300">
      {children}
    </p>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-indigo-400"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-xl bg-slate-100 p-4 text-sm dark:bg-slate-800">
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 ps-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 ps-6">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-slate-600 dark:text-slate-300">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900 dark:text-white">
      {children}
    </strong>
  ),
  h1: ({ children }) => (
    <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-3 font-semibold text-slate-900 dark:text-white">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
      {children}
    </h5>
  ),
  h5: ({ children }) => (
    <h6 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
      {children}
    </h6>
  ),
  h6: ({ children }) => (
    <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
      {children}
    </p>
  ),
  // Issue bodies embed screenshots from arbitrary GitHub-hosted URLs, not
  // just the hostnames next.config.ts allowlists for next/image (#215) — a
  // plain <img>, sanitized the same way as every other element here (see
  // the doc comment below), is what actually works for that content.
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      loading="lazy"
      className="aspect-video w-full max-w-full rounded-xl border border-slate-200 object-contain dark:border-slate-700"
    />
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-s-2 border-slate-300 ps-4 text-slate-500 italic dark:border-slate-700 dark:text-slate-400">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-start font-medium text-slate-700 dark:text-slate-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{children}</td>
  ),
};

/**
 * Renders a bounty's description — raw GitHub issue Markdown, i.e.
 * untrusted, third-party, attacker-reachable content with no backend
 * sanitization guaranteed anywhere in this pipeline (see #89) — as safely
 * rendered Markdown instead of a garbled plain-text blob.
 *
 * Deliberately does NOT enable `rehype-raw` (or any raw-HTML-passthrough
 * plugin/`components` override that widens what's allowed): react-markdown's
 * default behavior already renders embedded HTML tags (`<img onerror=...>`,
 * `<script>`, etc.) as inert literal text rather than real DOM nodes, and
 * its default `urlTransform` strips dangerous URL schemes (`javascript:`,
 * `data:`, etc.) from every `href`/`src` it emits. Together these are the
 * actual, load-bearing sanitization for this content — this app has no CSP
 * yet (see next.config.ts), so this render-time behavior is the only
 * defense layer. Do not add `rehype-raw` without re-reading #89 first.
 */
export function BountyDescription({ description }: { description: string }) {
  return (
    <div className="mt-6 space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {description}
      </ReactMarkdown>
    </div>
  );
}
