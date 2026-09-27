import { fetchReputationByUsername } from "@/lib/api";
import { generateMetadata } from "./page";
import { mockReputationProfiles } from "@/lib/mock-data";

jest.mock("next/navigation", () => ({ notFound: jest.fn() }));
jest.mock("@/lib/api", () => ({ fetchReputationByUsername: jest.fn() }));

const mockFetch = fetchReputationByUsername as jest.MockedFunction<
  typeof fetchReputationByUsername
>;

const meta = (handle: string) => generateMetadata({ params: Promise.resolve({ handle }) });

/**
 * Per-page metadata is the enforcement point for the noindex fallback: a
 * profile excluded from the sitemap can still be indexed from an inbound link
 * unless the page itself says so.
 */
describe("reputation page robots metadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks a profile that has not opted in as noindex, nofollow", async () => {
    mockFetch.mockResolvedValue({
      data: { ...mockReputationProfiles.priyaeth, indexable: false },
      source: "live",
    });

    expect((await meta("priyaeth")).robots).toEqual({ index: false, follow: false });
  });

  it("allows indexing for a profile that has opted in", async () => {
    mockFetch.mockResolvedValue({
      data: { ...mockReputationProfiles.priyaeth, indexable: true },
      source: "live",
    });

    expect((await meta("priyaeth")).robots).toEqual({ index: true, follow: true });
  });

  it("treats a missing opt-in flag as not indexable", async () => {
    const withoutFlag = { ...mockReputationProfiles.priyaeth };
    delete withoutFlag.indexable;
    mockFetch.mockResolvedValue({ data: withoutFlag, source: "live" });

    expect((await meta("priyaeth")).robots).toEqual({ index: false, follow: false });
  });

  it("keeps the title and social metadata intact for a non-indexed profile", async () => {
    mockFetch.mockResolvedValue({
      data: { ...mockReputationProfiles.priyaeth, indexable: false },
      source: "live",
    });

    const metadata = await meta("priyaeth");

    // noindex is about search engines, not about the page being shareable.
    expect(metadata.title).toBe("@priyaeth | MergeFi");
    expect(metadata.openGraph?.title).toBe("@priyaeth | MergeFi");
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
});
