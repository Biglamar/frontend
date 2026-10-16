import { fetchBounties, fetchIndexableReputationHandles } from "./api";
import { mockBounties, mockReputationProfiles } from "./mock-data";
import { chunk, MAX_URLS_PER_SITEMAP } from "./seo-policy";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mergefi.app";

/** Public, non-authenticated routes worth crawling. */
const STATIC_ROUTES = ["", "/issues", "/milestones", "/connect"];

export type SitemapEntry = {
  url: string;
  /** Omitted for static routes — crawlers can't distinguish real changes from rebuild noise (#635). */
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

/**
 * Every URL eligible for the sitemap, in policy order.
 *
 * Profile routes are included only for contributors who have opted into
 * search-engine indexing (see src/lib/seo-policy.ts) — fetchIndexableReputationHandles
 * filters on the backend's `isProfilePublic` flag, so the directory of
 * "who earns what, by real GitHub handle" is not handed to crawlers wholesale.
 */
export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const [bountiesRes, handlesRes] = await Promise.all([
    fetchBounties(mockBounties),
    fetchIndexableReputationHandles(Object.keys(mockReputationProfiles)),
  ]);

  // #634 — Exclude mock bounty URLs from the sitemap in production. Mock
  // data is development-only fallback; listing it in a production sitemap
  // generates URLs that 404 or render sample data once the backend is back.
  const isProduction = process.env.NODE_ENV === "production";
  const bounties = isProduction
    ? bountiesRes.data.filter((b) => bountiesRes.source !== "mock")
    : bountiesRes.data;

  const entries: SitemapEntry[] = [
    // #635 — static routes have no meaningful "last modified" timestamp;
    // omit lastModified so crawlers don't see a fake change date on every rebuild.
    ...STATIC_ROUTES.map((route) => ({
      url: `${SITE_URL}${route}`,
      changeFrequency: "daily" as const,
      priority: route === "" ? 1 : 0.8,
    })),
    // #635 — bounty pages use the bounty's updatedAt timestamp so crawlers
    // can tell what actually changed between rebuilds.
    ...bounties.map((bounty) => ({
      url: `${SITE_URL}/issues/${encodeURIComponent(bounty.id)}`,
      lastModified: new Date(
        (bounty as { updatedAt?: string }).updatedAt ?? Date.now(),
      ),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    // #635 — reputation pages use the snapshot's computedAt timestamp when available.
    ...handlesRes.data.map((handle) => {
      const profile = mockReputationProfiles[handle];
      const computedAt = (profile as { computedAt?: string } | undefined)
        ?.computedAt;
      return {
        url: `${SITE_URL}/reputation/${encodeURIComponent(handle)}`,
        ...(computedAt ? { lastModified: new Date(computedAt) } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.5,
      };
    }),
  ];

  return entries;
}

/**
 * Split entries into sitemap files that respect the 50,000-URL-per-file limit
 * search engines enforce. Returns a single chunk in the overwhelmingly common
 * case; multiple chunks only once the site outgrows one file.
 */
export function splitIntoSitemaps(entries: SitemapEntry[]): SitemapEntry[][] {
  return chunk(entries, MAX_URLS_PER_SITEMAP);
}

/**
 * How long a derived sitemap chunk list is reused in-process. Crawlers
 * refetch sitemaps aggressively, and re-deriving the list means re-hitting
 * /users and /bounties; an hour keeps the sitemap fresh enough to be useful
 * without turning crawler traffic into backend load. The response is also
 * marked CDN-cacheable by the route handler, so in practice the origin only
 * recomputes when nothing else is serving.
 */
export const SITEMAP_CACHE_TTL_MS = 60 * 60 * 1000;

let cache: { at: number; chunks: SitemapEntry[][] } | null = null;

/** Memoized chunk list, shared by the route handler and robots.ts. */
export async function getSitemapChunks(): Promise<SitemapEntry[][]> {
  if (cache && Date.now() - cache.at < SITEMAP_CACHE_TTL_MS) return cache.chunks;
  const entries = await buildSitemapEntries();
  const chunks = splitIntoSitemaps(entries);
  // #634 — Don't cache a sitemap built from mock fallback data in production,
  // so the next request retries the live backend instead of serving stale
  // mock URLs for the full TTL.
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction || entries.length > 0) {
    cache = { at: Date.now(), chunks };
  }
  return chunks;
}

/** Test seam: drops the memoized list so a test can observe a fresh fetch. */
export function resetSitemapCache(): void {
  cache = null;
}

/** Absolute URLs of every generated sitemap file, for robots.txt. */
export async function sitemapUrls(): Promise<string[]> {
  const chunks = await getSitemapChunks();
  return chunks.map((_, index) => `${SITE_URL}/sitemaps/${index}.xml`);
}
