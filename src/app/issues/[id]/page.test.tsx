import { render, screen } from "@testing-library/react";
import { fetchBounty } from "@/lib/api";
import type { Bounty, BountyStatus } from "@/types";
import { formatCurrency } from "@/lib/utils";
import IssueDetailPage, { generateMetadata } from "./page";

jest.mock("next/navigation", () => ({ notFound: jest.fn() }));
jest.mock("@/lib/api", () => ({ fetchBounty: jest.fn() }));
jest.mock("./IssueActions", () => ({ IssueActions: () => null }));
jest.mock("@/components/bounty/BountyDescription", () => ({
  BountyDescription: ({ description }: { description: string }) => (
    <p>{description}</p>
  ),
}));

const mockFetchBounty = fetchBounty as jest.MockedFunction<typeof fetchBounty>;

function makeBounty(overrides: Partial<Bounty> = {}): Bounty {
  return {
    id: "test-issue",
    org: "mergefi",
    repo: "frontend",
    issueNumber: 42,
    title: "Test bounty",
    description: "A test bounty description.",
    reward: 125,
    asset: "USDC",
    difficulty: "beginner",
    status: "open",
    deadline: null,
    labels: [],
    ...overrides,
  };
}

async function renderIssue(bounty: Bounty) {
  mockFetchBounty.mockResolvedValue({ data: bounty, source: "mock" });
  const page = await IssueDetailPage({
    params: Promise.resolve({ id: bounty.id }),
  });
  render(page);
}

describe("IssueDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["open", "Awaiting funding"],
    ["funded", "Funds locked"],
    ["claimed", "Funds locked"],
    ["in_review", "Funds locked"],
    ["merged", "Funds locked"],
    ["paid", "Paid out"],
    ["refunded", "Refunded to sponsor"],
    ["expired", "Expired, unclaimed"],
  ] as const)(
    "shows the escrow label for %s bounties",
    async (status, label) => {
      await renderIssue(makeBounty({ status: status as BountyStatus }));

      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it("renders duplicate team-split roles without a React key warning", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await renderIssue(
      makeBounty({
        teamSplits: [
          { role: "Contributor", percentage: 50 },
          { role: "Contributor", percentage: 50 },
        ],
      }),
    );

    expect(screen.getAllByText("Contributor")).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("same key"),
    );
    consoleError.mockRestore();
  });

  it("shows the milestone indicator for milestone bounties", async () => {
    await renderIssue(makeBounty({ milestoneId: "milestone-1" }));
    expect(screen.getByText("Part of a funded milestone")).toBeInTheDocument();
  });


  it("omits the milestone indicator for non-milestone bounties", async () => {
    await renderIssue(makeBounty());
    expect(
      screen.queryByText("Part of a funded milestone"),
    ).not.toBeInTheDocument();
  });

  it("builds issue metadata from the bounty title, reward, and description", async () => {
    const bounty = makeBounty();
    mockFetchBounty.mockResolvedValue({ data: bounty, source: "mock" });

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: bounty.id }),
    });

    expect(metadata.title).toBe(
      `${bounty.title} — ${formatCurrency(bounty.reward, bounty.asset)} | MergeFi`,
    );
    expect(metadata.description).toBe(bounty.description);
    expect(metadata.openGraph?.description).toBe(bounty.description);
  });
});

/**
 * teamSplitsValid used to be computed by adaptBounty and then read by nothing
 * in the app, so a bounty whose splits summed to 85% rendered a public payout
 * breakdown with no indication anything was wrong (#419).
 */
describe("IssueDetailPage — team split validity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const splits = (percentages: number[]) =>
    percentages.map((percentage, i) => ({
      role: `Role ${i + 1}`,
      percentage,
    }));

  it("warns with validateTeamSplits' own message when splits are invalid", async () => {
    await renderIssue(
      makeBounty({
        teamSplits: splits([50, 35]),
        teamSplitsValid: {
          valid: false,
          sum: 85,
          message: "Team splits sum to 85.00% (expected 100%)",
        },
      }),
    );

    // The individual shares still render — the warning supplements the data.
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Team splits sum to 85.00% (expected 100%)",
    );
  });

  it("warns for over-funded splits too", async () => {
    await renderIssue(
      makeBounty({
        teamSplits: splits([70, 40]),
        teamSplitsValid: {
          valid: false,
          sum: 110,
          message: "Team splits sum to 110.00% (expected 100%)",
        },
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Team splits sum to 110.00% (expected 100%)",
    );
  });

  it("renders no warning when splits are valid", async () => {
    await renderIssue(
      makeBounty({
        teamSplits: splits([60, 40]),
        teamSplitsValid: { valid: true, sum: 100 },
      }),
    );

    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Team splits sum to/),
    ).not.toBeInTheDocument();
  });

  it("renders no warning when a bounty has no team at all", async () => {
    await renderIssue(makeBounty());

    expect(
      screen.queryByText("Team payout split"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders no warning for an empty splits array, and shows no split section", async () => {
    // validateTeamSplits([]) short-circuits to { valid: true, sum: 0 }, so an
    // empty-but-present array must not trigger a spurious "sums to 0%"
    // warning — and an empty array is truthy, so the render guard has to be
    // an explicit length check or a bare "Team payout split" header renders.
    await renderIssue(
      makeBounty({ teamSplits: [], teamSplitsValid: { valid: true, sum: 0 } }),
    );

    expect(
      screen.queryByText("Team payout split"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
