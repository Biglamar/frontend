/**
 * Tests for PipelineBoard (#88).
 *
 * The pipeline board previously had no column for "merged" (payout-pending)
 * bounties, silently dropping them from the board even though the page's
 * own "Value locked in escrow" stat still counted them. Extracted from the
 * async MaintainerDashboardPage into a plain function of already-fetched
 * bounties so it's directly testable without mocking data-fetching.
 */

import { render, screen } from "@testing-library/react";
import { PipelineBoard, pipelineStages, ESCROW_LOCKED_EXCLUDED_STATUSES } from "./PipelineBoard";
import type { Bounty, BountyStatus } from "@/types";

function makeBounty(overrides: Partial<Bounty> = {}): Bounty {
  return {
    id: "bounty-1",
    repo: "smartdrop-backend",
    org: "SmartDropLabs",
    issueNumber: 42,
    title: "Fix retry backoff jitter",
    description: "A description",
    reward: 500,
    asset: "USDC",
    difficulty: "intermediate",
    status: "open",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    labels: [],
    ...overrides,
  };
}

describe("PipelineBoard — merged column (#88)", () => {
  it("renders a bounty with status 'merged' in a visible pipeline column", () => {
    const merged = makeBounty({ id: "merged-1", title: "Merged, awaiting payout", status: "merged" });
    render(<PipelineBoard bounties={[merged]} />);

    expect(screen.getByText("Merged, awaiting payout")).toBeInTheDocument();
    // A column labelled for the merged stage exists and shows count 1.
    expect(screen.getByText("Awaiting payout")).toBeInTheDocument();
  });

  it("includes 'merged' in pipelineStages", () => {
    expect(pipelineStages.some((s) => s.status === "merged")).toBe(true);
  });

  it("does not regress the existing four columns' rendering or counts", () => {
    const bounties: Bounty[] = [
      makeBounty({ id: "1", title: "Open one", status: "open" }),
      makeBounty({ id: "2", title: "Funded one", status: "funded" }),
      makeBounty({ id: "3", title: "Claimed one", status: "claimed" }),
      makeBounty({ id: "4", title: "In review one", status: "in_review" }),
    ];
    render(<PipelineBoard bounties={bounties} />);

    expect(screen.getByText("Open one")).toBeInTheDocument();
    expect(screen.getByText("Funded one")).toBeInTheDocument();
    expect(screen.getByText("Claimed one")).toBeInTheDocument();
    expect(screen.getByText("In review one")).toBeInTheDocument();

    for (const label of ["Open", "Funded", "Claimed", "In review"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows an empty-state placeholder for a stage with no matching bounties", () => {
    render(<PipelineBoard bounties={[]} />);
    // 5 stages -> 5 "Nothing here" placeholders.
    expect(screen.getAllByText("Nothing here")).toHaveLength(pipelineStages.length);
  });

  it("does not place a 'paid' bounty in any pipeline column", () => {
    const paid = makeBounty({ id: "paid-1", title: "Already paid out", status: "paid" });
    render(<PipelineBoard bounties={[paid]} />);

    // Deliberate: "paid" is a terminal state, intentionally not a column.
    expect(screen.queryByText("Already paid out")).not.toBeInTheDocument();
  });
});

describe("PipelineBoard / escrow-stat consistency (#88)", () => {
  it("gives every escrow-locked status a corresponding pipeline column", () => {
    const allStatuses: BountyStatus[] = [
      "open",
      "funded",
      "claimed",
      "in_review",
      "merged",
      "release_failed",
      "paid",
      "refunded",
      "expired",
      "unknown",
    ];
    const escrowLockedStatuses = allStatuses.filter(
      (status) => !ESCROW_LOCKED_EXCLUDED_STATUSES.includes(status),
    );
    const columnStatuses = new Set(pipelineStages.map((s) => s.status));

    for (const status of escrowLockedStatuses) {
      expect(columnStatuses.has(status)).toBe(true);
    }
  });

  it("intentionally leaves terminal statuses (paid, refunded, expired) without a pipeline column", () => {
    const columnStatuses = new Set(pipelineStages.map((s) => s.status));
    for (const status of ["paid", "refunded", "expired"] as const) {
      expect(ESCROW_LOCKED_EXCLUDED_STATUSES).toContain(status);
      expect(columnStatuses.has(status)).toBe(false);
    }
  });
});
