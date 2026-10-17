/**
 * Strips common Markdown syntax down to plain, readable text.
 *
 * Used for BountyCard's `line-clamp-2` preview (#89): that context needs
 * predictable, single-line-flowing inline text — rendering full Markdown
 * there risks block-level elements (headings, code fences, lists) breaking
 * a 2-line CSS clamp in ways plain text can't, and pulling react-markdown
 * into the bundle for every card in every list view isn't justified just
 * to show a two-line snippet. Full Markdown rendering lives in
 * BountyDescription, used only on the (single, non-list) issue detail page.
 *
 * Deliberately not a spec-accurate GFM parser — good enough to turn
 * "**bold** [text](url)" into "bold text" rather than showing a raw,
 * mid-syntax markdown fragment truncated by the clamp.
 */
export function stripMarkdownToPlainText(markdown: string): string {
  return markdown
    // Fenced code blocks -> their inner content, unfenced.
    .replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, "$1")
    // Fallback for an unterminated fence (opened but never closed, e.g. a
    // truncated description or a forgotten trailing ```): the paired regex
    // above can't match it, so strip the leftover ``` markers/language tag
    // directly rather than leaving them visible in the preview (#199).
    .replace(/```[a-zA-Z0-9]*\n?/g, "")
    // Images: drop entirely — alt text isn't meaningful in a short preview.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Links: keep the link text, drop the URL.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Inline code.
    .replace(/`([^`]+)`/g, "$1")
    // Bold+italic, then bold, then italic (order matters — longest marker first).
    .replace(/(\*\*\*|___)([^*_]+)\1/g, "$2")
    .replace(/(\*\*|__)([^*_]+)\1/g, "$2")
    .replace(/(\*|_)([^*_]+)\1/g, "$2")
    // Strikethrough.
    .replace(/~~([^~]+)~~/g, "$1")
    // Headings.
    .replace(/^#{1,6}\s+/gm, "")
    // Blockquotes.
    .replace(/^>\s?/gm, "")
    // GFM task-list markers: "- [ ] item" / "- [x] item" — strip the whole
    // "- [ ] " prefix (checkbox included) before the generic list-marker
    // rule below would leave "[ ] item" behind as visible noise (#682).
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    // List markers.
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // GFM tables: drop the separator row (|---|---| / | :-- | --: | / |-|-|)
    // and turn the remaining column pipes into spaces so "| a | b |" reads
    // as "a b" in a one-line preview instead of showing raw table syntax
    // (#682). The separator rule matches any line composed solely of
    // pipes/colons/dashes/whitespace containing at least one dash — it must
    // run before the pipe replacement, because once the pipes are spaces a
    // separator row is just a whitespace-only line.
    .replace(/^[ \t]*[\t| :-]*-[\t| :-]*$/gm, "")
    .replace(/\|/g, " ")
    // Collapse newlines/whitespace into single spaces for inline flow.
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
