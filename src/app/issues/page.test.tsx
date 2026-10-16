/**
 * issues/page.test.tsx (#456)
 *
 * Covers the filter → empty-state data flow and the composition of the
 * "nothing to show" signal with the "this isn't real data" signal.
 *
 * The distinction under test: "zero results because a filter is hiding them"
 * and "zero results because the platform has none" need different copy and
 * different calls to action, and neither may be confused with "the backend is
 * unreachable". Before this, /issues had no filtering at all, so the two
 * cases collapsed into a single `bounties.length === 0` branch.
 */

import { render, screen } from "@testing-library/react";
import IssuesPage from "./page";
import { fetchBounties } from "@/lib/api";
import { mockBounties } from "@/lib/mock-data";
import type { Bounty } from "@/types";

jest.mock("@/lib/api", () => ({ fetchBounties: jest.fn() }));

jest.mock("next/link", () => {
  // `prefetch` is a next/link-only prop; spreading it onto a real <a> makes
  // React warn about an unknown DOM attribute. Dropped via `delete` rather
  // than destructuring so no unused binding is introduced.
  const Link = ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const anchorProps = { ...props } as Record<string, unknown>;
    delete anchorProps.prefetch;
    return (
      <a href={href} {...anchorProps}>
        {children}
      </a>
    );
  };
  return { __esModule: true, default: Link };
});

const mockFetchBounties = fetchBounties as jest.Mock;

/** All-open fixture so a status filter is guaranteed to reduce the result set. */
const OPEN_BOUNTIES: Bounty[] = mockBounties.map((b) => ({ ...b, status: "open" as const }));

async function renderPage(params: Record<string, string> = {}) {
  const element = await IssuesPage({ searchParams: Promise.resolve(params) });
  return render(element);
}

beforeEach(() => {
  mockFetchBounties.mockReset();
  mockFetchBounties.mockResolvedValue({ data: OPEN_BOUNTIES, source: "live" });
});

// ─── 1. Filtered-to-zero is distinct from genuinely-empty ───────────────────

describe("/issues — filtered to zero results", () => {
  it("offers a clear-filters CTA, not a fund-a-bounty CTA", async () => {
    // The right fix differs: here the bounties exist and the visitor's own
    // filter is hiding them, so inviting them to fund another is wrong.
    mockFetchBounties.mockResolvedValue({
      data: [{ ...OPEN_BOUNTIES[0], status: "paid" }],
      source: "live",
    });

    await renderPage({ status: "open" });

    expect(screen.getByText("No bounties match these filters")).toBeInTheDocument();
    expect(screen.getByText("Clear filters").closest("a")).toHaveAttribute("href", "/issues");
    expect(screen.queryByText("Fund a bounty")).not.toBeInTheDocument();
  });

  it("tells the reader how many bounties are being hidden", async () => {
    // Two bounties exist, the "open" filter matches neither.
    mockFetchBounties.mockResolvedValue({
      data: [
        { ...OPEN_BOUNTIES[0], status: "paid" },
        { ...OPEN_BOUNTIES[1], status: "merged" },
      ],
      source: "live",
    });

    await renderPage({ status: "open" });

    // The interpolated total makes the sentence several text nodes, so assert
    // against the assembled copy rather than a single text match.
    expect(document.body.textContent).toContain(
      "Every bounty is hidden by the filters you have active. Clear them to see all 2 available.",
    );
  });

  it("uses the info tone, not the neutral one", async () => {
    mockFetchBounties.mockResolvedValue({
      data: [{ ...OPEN_BOUNTIES[0], status: "paid" }],
      source: "live",
    });

    const { container } = await renderPage({ status: "open" });

    expect((container.querySelector("[class*='rounded-2xl']") as HTMLElement).className).toMatch(
      /indigo/,
    );
  });
});

describe("/issues — genuinely empty", () => {
  it("offers a fund-a-bounty CTA when the platform has no bounties", async () => {
    mockFetchBounties.mockResolvedValue({ data: [], source: "live" });

    await renderPage();

    expect(screen.getByText("No bounties yet")).toBeInTheDocument();
    expect(screen.getByText("Fund a bounty").closest("a")).toHaveAttribute("href", "/connect");
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("does not claim a filter is hiding anything when none is active", async () => {
    mockFetchBounties.mockResolvedValue({ data: [], source: "live" });

    await renderPage();

    expect(screen.queryByText("No bounties match these filters")).not.toBeInTheDocument();
  });
});

// ─── 2. Filter actually filters ────────────────────────────────────────────

describe("/issues — the status filter", () => {
  it("renders matching bounties for an active filter", async () => {
    await renderPage({ status: "open" });

    for (const bounty of OPEN_BOUNTIES) {
      expect(screen.getByText(bounty.title)).toBeInTheDocument();
    }
  });

  it("hides non-matching bounties", async () => {
    mockFetchBounties.mockResolvedValue({
      data: [{ ...OPEN_BOUNTIES[0], status: "paid" }],
      source: "live",
    });

    await renderPage({ status: "open" });

    expect(screen.queryByText(OPEN_BOUNTIES[0].title)).not.toBeInTheDocument();
  });

  it("marks the active filter for assistive tech", async () => {
    await renderPage({ status: "open" });

    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("links 'All' to the unfiltered URL", async () => {
    await renderPage({ status: "open" });

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/issues");
  });

  it("ignores an unrecognized filter value instead of blanking the page", async () => {
    // A hand-edited or stale ?status= must degrade to "all", not to an empty
    // list that reads as "this platform has no bounties".
    await renderPage({ status: "not-a-status" });

    expect(screen.getByText(OPEN_BOUNTIES[0].title)).toBeInTheDocument();
  });

  it("renders the filtered count alongside the total", async () => {
    await renderPage({ status: "open" });

    // Counts are locale-formatted (#456), so "5 of 5" in en-US.
    expect(
      screen.getByText(`${OPEN_BOUNTIES.length} of ${OPEN_BOUNTIES.length}`),
    ).toBeInTheDocument();
  });
});

// ─── 3. Emptiness and "not real data" compose ──────────────────────────────

describe("/issues — sample data composes with emptiness (#456)", () => {
  it("shows BOTH signals when the backend is down and the list is empty", async () => {
    // These are independent facts. Rendering only the empty state implies the
    // platform really has no bounties; rendering only the notice leaves the
    // reader staring at a blank region with no explanation.
    mockFetchBounties.mockResolvedValue({ data: [], source: "mock" });

    await renderPage();

    expect(screen.getByText("No bounties yet")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Sample data/);
    expect(screen.getByText(/MergeFi API is unreachable/)).toBeInTheDocument();
  });

  it("shows BOTH signals when the backend is down and a filter matches nothing", async () => {
    mockFetchBounties.mockResolvedValue({ data: [], source: "mock" });

    await renderPage({ status: "open" });

    expect(screen.getByText("No bounties match these filters")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Sample data/);
  });

  it("shows the notice on a populated mock list too", async () => {
    mockFetchBounties.mockResolvedValue({ data: OPEN_BOUNTIES, source: "mock" });

    await renderPage();

    expect(screen.queryByText("No bounties yet")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Sample data/);
  });

  it("shows no notice when the data is live", async () => {
    await renderPage();

    expect(screen.queryByText(/Sample data/)).not.toBeInTheDocument();
  });
});
