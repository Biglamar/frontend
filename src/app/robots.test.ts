import { fetchBounties, fetchIndexableReputationHandles } from "@/lib/api";
import { resetSitemapCache } from "@/lib/sitemap";
import robots from "./robots";

jest.mock("@/lib/api", () => ({
  fetchBounties: jest.fn(),
  fetchIndexableReputationHandles: jest.fn(),
}));

const mockFetchBounties = fetchBounties as jest.MockedFunction<typeof fetchBounties>;
const mockFetchHandles = fetchIndexableReputationHandles as jest.MockedFunction<
  typeof fetchIndexableReputationHandles
>;

beforeEach(() => {
  jest.clearAllMocks();
  // sitemapUrls() memoizes for an hour in-process, so without this each test
  // would inherit the previous test's (much smaller) chunk count.
  resetSitemapCache();
  mockFetchBounties.mockResolvedValue({ data: [], source: "mock" });
  mockFetchHandles.mockResolvedValue({ data: [], source: "mock" });
});

/**
 * robots.txt, the sitemap, and per-page metadata all have to agree about who
 * is indexable. These tests pin the robots.txt half of that contract.
 */
describe("robots.txt", () => {
  it("keeps the authenticated surfaces disallowed", async () => {
    const result = await robots();

    expect(result.rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/auth/callback"],
    });
  });

  it("does not disallow /reputation/, so crawlers can read the noindex tag", async () => {
    const result = await robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const disallow = rules.flatMap((r) => (Array.isArray(r.disallow) ? r.disallow : [r.disallow]));

    // Disallowing the path would stop crawlers fetching the page, so they'd
    // never see the `noindex` metadata — and an already-indexed URL would stay
    // indexed. See src/lib/seo-policy.ts.
    expect(disallow).not.toContain("/reputation/");
    expect(disallow.join(" ")).not.toContain("/reputation");
  });

  it("advertises the chunked sitemap files", async () => {
    mockFetchHandles.mockResolvedValue({
      data: Array.from({ length: 60_000 }, (_, i) => `c-${i}`),
      source: "mock",
    });

    const result = await robots();

    expect(result.sitemap).toEqual([
      expect.stringMatching(/\/sitemaps\/0\.xml$/),
      expect.stringMatching(/\/sitemaps\/1\.xml$/),
    ]);
  });
});
