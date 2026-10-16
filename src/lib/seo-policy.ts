/**
 * Search-engine indexability policy for MergeFi.
 *
 * ── The decision, and why ────────────────────────────────────────────────────
 * Contributor profile pages (/reputation/[handle]) server-render a real GitHub
 * handle, avatar, organisations, and lifetime earnings. The previous behaviour
 * was to treat every profile as indexable: robots.ts allowed crawling, and
 * sitemap.ts enumerated every handle the /users endpoint returned, which builds
 * a public, crawlable directory of who earns what, tied to real identities.
 *
 * Default chosen here: **opt-in for search-engine indexability, public by
 * direct link.** A profile stays reachable and shareable at its URL; it is
 * simply not submitted to, or indexed by, search engines unless the
 * contributor has explicitly opted in.
 *
 * The asymmetry is the whole argument. Search indexing is effectively
 * irreversible in practice — removal requests are slow, partial, and never
 * complete for URLs already crawled and cached. A default of "indexable unless
 * the contributor opts out" therefore makes the *harm* permanent and
 * irreversible, while the harm of "not indexed unless the contributor opts in"
 * is a recoverable loss of SEO surface that the contributor themselves can
 * unlock at any time. For data that reads as sensitive to the people it
 * describes (earnings attached to a legal name), fail-safe beats fail-open.
 *
 * Lifetime earnings are deliberately still server-rendered for opted-in
 * profiles. Client-fetching-and-gating them would only hide them from crawlers
 * that were already granted permission, while breaking the page for anyone
 * whose JS fails — the actual protection is the opt-in, not the rendering
 * strategy.
 *
 * ── What this needs from mergefi-backend ─────────────────────────────────────
 * The opt-in flag does not exist in the backend's user entity yet. The
 * frontend reads it defensively (see `profileIsIndexable`) from the
 * `isProfilePublic` field on the /users response, defaulting to *not*
 * indexable when absent. So today nothing is indexed — the safe side of the
 * tradeoff — and the moment the backend adds the field (plus a settings UI to
 * set it) profiles become indexable with no further frontend change.
 *
 * Consistency is enforced across all three surfaces that can disagree:
 * this module, src/app/robots.ts, src/app/sitemap.ts, and the per-page
 * `robots` metadata in src/app/reputation/[handle]/page.tsx.
 */

/** Sitemap spec hard limit: 50,000 URLs per sitemap file. */
export const MAX_URLS_PER_SITEMAP = 50_000;

/**
 * Whether a profile may be indexed by search engines.
 *
 * Missing/false/non-boolean values all mean "not indexable" — the safe default
 * documented above. Reads `isProfilePublic` off the adapted profile rather than
 * the raw entity so every consumer (page metadata, sitemap) shares one
 * decision and can't drift.
 */
export function profileIsIndexable(profile: { indexable?: boolean }): boolean {
  return profile.indexable === true;
}

/** Split a list into fixed-size chunks, dropping a trailing empty chunk. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new RangeError("chunk size must be greater than zero");
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
