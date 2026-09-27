/**
 * @jest-environment node
 *
 * This is a server Route Handler: it uses the global `Response` constructor,
 * which jsdom (the default test environment) does not provide.
 */
import { fetchBounties, fetchIndexableReputationHandles } from "@/lib/api";
import { MAX_URLS_PER_SITEMAP } from "@/lib/seo-policy";
import { resetSitemapCache } from "@/lib/sitemap";
import { GET } from "./route";

jest.mock("@/lib/api", () => ({
  fetchBounties: jest.fn(),
  fetchIndexableReputationHandles: jest.fn(),
}));

const mockFetchBounties = fetchBounties as jest.MockedFunction<typeof fetchBounties>;
const mockFetchHandles = fetchIndexableReputationHandles as jest.MockedFunction<
  typeof fetchIndexableReputationHandles
>;

const get = (id: string) =>
  GET({} as Request, { params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  resetSitemapCache();
  mockFetchBounties.mockResolvedValue({ data: [], source: "mock" });
  mockFetchHandles.mockResolvedValue({ data: ["alpha", "beta"], source: "mock" });
});

describe("/sitemaps/[id] route", () => {
  it("serves a urlset of the site's URLs as XML", async () => {
    const res = await get("0");
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain("<urlset");
    expect(body).toContain("<loc>https://mergefi.app/issues</loc>");
  });

  it("lists the opted-in profile routes", async () => {
    const body = await (await get("0")).text();

    expect(body).toContain("<loc>https://mergefi.app/reputation/alpha</loc>");
    expect(body).toContain("<loc>https://mergefi.app/reputation/beta</loc>");
  });

  // The dynamic segment captures the whole filename, so "/sitemaps/0.xml"
  // arrives as "0.xml" — parsing that as a number is a NaN 404.
  it.each(["0", "0.xml"])("accepts the id spelled as %p", async (id) => {
    const res = await get(id);

    expect(res.status).toBe(200);
  });

  it("is CDN-cacheable so crawler traffic doesn't reach the origin every time", async () => {
    const res = await get("0");

    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(res.headers.get("cache-control")).toContain("stale-while-revalidate");
  });

  it("404s an id past the end without caching the answer", async () => {
    const res = await get("7");

    expect(res.status).toBe(404);
    // The chunk count grows over time, so a "not found" must not be cached.
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["-1", "abc", "1.5"])("404s the non-integer id %p", async (id) => {
    expect((await get(id)).status).toBe(404);
  });

  it("splits at the 50,000-URL limit into separately-servable files", async () => {
    mockFetchHandles.mockResolvedValue({
      data: Array.from({ length: 60_000 }, (_, i) => `c-${i}`),
      source: "mock",
    });

    const first = await (await get("0")).text();
    const second = await (await get("1")).text();

    expect(first).toContain("<loc>https://mergefi.app/reputation/c-0</loc>");
    // The boundary is exact: c-50000 is the first entry of the second file,
    // and nothing beyond the limit leaks into the first.
    expect(first).not.toContain("reputation/c-50000<");
    expect(second).toContain("<loc>https://mergefi.app/reputation/c-50000</loc>");
    // Neither file approaches the 50MB spec ceiling at this entry size.
    expect(first.length).toBeLessThan(50 * 1024 * 1024);
    expect(second.length).toBeLessThan(50 * 1024 * 1024);
    expect(MAX_URLS_PER_SITEMAP).toBe(50_000);
  });

  it("cannot emit a broken <loc> from a hostile handle", async () => {
    // Handles are percent-encoded when the URL is built, which is the primary
    // protection; escapeXml in the handler is defence-in-depth behind it.
    mockFetchHandles.mockResolvedValue({
      data: ['a&b<c>"d'],
      source: "mock",
    });

    const body = await (await get("0")).text();
    const locs = body.match(/<loc>([^<]*)<\/loc>/g) ?? [];

    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      // Nothing between the tags can terminate the element or start an entity.
      const inner = loc.slice("<loc>".length, -"</loc>".length);
      expect(inner).not.toMatch(/[<>&"']/);
    }
    expect(body).toContain("a%26b%3Cc%3E%22d");
  });

  it("derives the URL list once per cache window, not once per request", async () => {
    await get("0");
    await get("0");
    await get("0");

    expect(mockFetchHandles).toHaveBeenCalledTimes(1);
    expect(mockFetchBounties).toHaveBeenCalledTimes(1);
  });
});
