import { fetchBounties, fetchIndexableReputationHandles } from "@/lib/api";
import { buildSitemapEntries, splitIntoSitemaps, sitemapUrls } from "@/lib/sitemap";
import { chunk, MAX_URLS_PER_SITEMAP } from "@/lib/seo-policy";
import type { Bounty } from "@/types";

jest.mock("@/lib/api", () => ({
  fetchBounties: jest.fn(),
  fetchIndexableReputationHandles: jest.fn(),
}));

const mockFetchBounties = fetchBounties as jest.MockedFunction<typeof fetchBounties>;
const mockFetchHandles = fetchIndexableReputationHandles as jest.MockedFunction<
  typeof fetchIndexableReputationHandles
>;

function makeBounty(id: string): Bounty {
  return {
    id,
    title: `Bounty ${id}`,
    description: "",
    reward: 100,
    asset: "USDC",
    difficulty: "beginner",
    status: "open",
    org: "acme",
    repo: "widgets",
    issueNumber: 1,
    labels: [],
    deadline: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchBounties.mockResolvedValue({ data: [], source: "mock" });
  mockFetchHandles.mockResolvedValue({ data: [], source: "mock" });
});

describe("buildSitemapEntries", () => {
  it("includes static, issue, and opted-in profile routes", async () => {
    mockFetchBounties.mockResolvedValue({
      data: [makeBounty("b-1"), makeBounty("b-2")],
      source: "mock",
    });
    mockFetchHandles.mockResolvedValue({ data: ["priyaeth"], source: "mock" });

    const urls = (await buildSitemapEntries()).map((e) => e.url);

    expect(urls).toEqual([
      "https://mergefi.app",
      "https://mergefi.app/issues",
      "https://mergefi.app/milestones",
      "https://mergefi.app/connect",
      "https://mergefi.app/issues/b-1",
      "https://mergefi.app/issues/b-2",
      "https://mergefi.app/reputation/priyaeth",
    ]);
  });

  it("percent-encodes handles and ids so odd values can't break the XML", async () => {
    mockFetchHandles.mockResolvedValue({ data: ["a b&c"], source: "mock" });

    const urls = (await buildSitemapEntries()).map((e) => e.url);

    expect(urls.some((u) => u.endsWith("/reputation/a%20b%26c"))).toBe(true);
  });
});

/**
 * The 50,000-URL-per-file limit is a hard search-engine constraint: a single
 * oversized file is silently ignored, so the whole site drops out of the index
 * rather than degrading.
 */
describe("splitIntoSitemaps — scale", () => {
  it("keeps a single file when the site fits in one", () => {
    const chunks = splitIntoSitemaps(
      Array.from({ length: MAX_URLS_PER_SITEMAP }, (_, i) => ({
        url: `/p/${i}`,
        lastModified: new Date(0),
      })),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(MAX_URLS_PER_SITEMAP);
  });

  it("rejects a non-positive chunk size instead of looping forever", () => {
    expect(() => splitIntoSitemaps([])).not.toThrow();
    expect(() => chunk([], 0)).toThrow(RangeError);
  });

  it("splits at exactly one URL over the limit, losing nothing", () => {
    const total = MAX_URLS_PER_SITEMAP + 1;
    const entries = Array.from({ length: total }, (_, i) => ({
      url: `/p/${i}`,
      lastModified: new Date(0),
    }));

    const chunks = splitIntoSitemaps(entries);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(MAX_URLS_PER_SITEMAP);
    expect(chunks[1]).toHaveLength(1);
    // Checked positionally rather than with a deep-equality over 50k objects:
    // the first and last entries of each file are the ones a slicing bug would
    // drop or duplicate, and it keeps the suite fast enough that a parallel
    // test run isn't starved by it.
    expect(chunks[0][0]).toBe(entries[0]);
    expect(chunks[0][MAX_URLS_PER_SITEMAP - 1]).toBe(entries[MAX_URLS_PER_SITEMAP - 1]);
    expect(chunks[1][0]).toBe(entries[MAX_URLS_PER_SITEMAP]);
  });

  it("never emits a file above the limit for a large user base", async () => {
    // ~120k opted-in profiles plus static and issue routes: three files.
    const handles = Array.from({ length: 120_000 }, (_, i) => `contributor-${i}`);
    mockFetchHandles.mockResolvedValue({ data: handles, source: "mock" });
    mockFetchBounties.mockResolvedValue({
      data: Array.from({ length: 500 }, (_, i) => makeBounty(`b-${i}`)),
      source: "mock",
    });

    const entries = await buildSitemapEntries();
    const chunks = splitIntoSitemaps(entries);

    expect(chunks).toHaveLength(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_URLS_PER_SITEMAP);
    }
    // Nothing dropped or duplicated: the per-file counts add back up to the
    // total, and consecutive files meet exactly at the boundary.
    expect(chunks.reduce((sum, c) => sum + c.length, 0)).toBe(entries.length);
    expect(chunks[0][0]).toBe(entries[0]);
    expect(chunks[chunks.length - 1].at(-1)).toBe(entries.at(-1));
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i][0]).toBe(entries[(i - 1) * MAX_URLS_PER_SITEMAP + MAX_URLS_PER_SITEMAP]);
    }
  });

  it("returns no files at all when there is nothing to list", () => {
    expect(splitIntoSitemaps([])).toEqual([]);
  });
});

describe("sitemapUrls", () => {
  it("advertises one sitemap URL per generated file", async () => {
    mockFetchHandles.mockResolvedValue({
      data: Array.from({ length: MAX_URLS_PER_SITEMAP + 5 }, (_, i) => `c-${i}`),
      source: "mock",
    });

    const urls = await sitemapUrls();

    expect(urls).toHaveLength(2);
    expect(urls[0]).toMatch(/\/sitemaps\/0\.xml$/);
    expect(urls[1]).toMatch(/\/sitemaps\/1\.xml$/);
  });
});
