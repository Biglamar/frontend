import { fetchBounties, fetchIndexableReputationHandles } from "./api";
import { mockBounties, mockReputationProfiles } from "./mock-data";
import { chunk, MAX_URLS_PER_SITEMAP } from "./seo-policy";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mergefi.app";

/** Public, non-authenticated routes worth crawling. */
const STATIC_ROUTES = ["", "/issues", "/milestones", "/connect"];

export type SitemapEntry = {
  url: string;
  lastModified: Date;
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

  const now = new Date();

  const entries: SitemapEntry[] = [
    ...STATIC_ROUTES.map((route) => ({
      url: `${SITE_URL}${route}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: route === "" ? 1 : 0.8,
    })),
    ...bountiesRes.data.map((bounty) => ({
      url: `${SITE_URL}/issues/${encodeURIComponent(bounty.id)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...handlesRes.data.map((handle) => ({
      url: `${SITE_URL}/reputation/${encodeURIComponent(handle)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
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
  const chunks = splitIntoSitemaps(await buildSitemapEntries());
  cache = { at: Date.now(), chunks };
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
