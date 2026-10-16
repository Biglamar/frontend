/**
 * Tests for BountyCard's description preview (#89).
 *
 * The line-clamp-2 preview renders bounty.description as plain text
 * (via stripMarkdownToPlainText), not through the full markdown renderer
 * BountyDescription uses on the detail page — full markdown rendering in
 * a two-line-clamped card risks block-level elements breaking the clamp,
 * and isn't justified bundle-size-wise for every card in every list view.
 */

import { render, screen } from "@testing-library/react";
import { BountyCard } from "./BountyCard";
import type { Bounty } from "@/types";

function makeBounty(overrides: Partial<Bounty> = {}): Bounty {
  return {
    id: "bounty-1",
    repo: "smartdrop-backend",
    org: "SmartDropLabs",
    issueNumber: 42,
    title: "Fix retry backoff jitter",
    description: "Plain description",
    reward: 500,
    asset: "USDC",
    difficulty: "intermediate",
    status: "open",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    labels: [],
    ...overrides,
  };
}

describe("BountyCard — description preview", () => {
  it("shows a description containing markdown as clean plain text, not a raw mid-syntax fragment", () => {
    const description =
      "The `getBalance()` call fails when the account is unfunded — see " +
      "[the original report](https://github.com/org/repo/issues/12) for **full** repro steps.";
    render(<BountyCard bounty={makeBounty({ description })} />);

    // No literal markdown syntax markers anywhere in the rendered card.
    expect(screen.queryByText(/`/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[the original report\]/)).not.toBeInTheDocument();

    // The readable text content survives, just as plain text.
    expect(
      screen.getByText(/The getBalance\(\) call fails when the account is unfunded/),
    ).toBeInTheDocument();
  });

  it("renders a plain (non-markdown) description unchanged", () => {
    render(<BountyCard bounty={makeBounty({ description: "A perfectly normal description." })} />);
    expect(screen.getByText("A perfectly normal description.")).toBeInTheDocument();
  });

  it("does not render an <a> or <code> element inside the preview (plain text only)", () => {
    const description = "See [docs](https://example.com) and `run this`.";
    render(<BountyCard bounty={makeBounty({ description })} />);

    // The whole card is itself a Link (<a href="/issues/...">), so scope
    // the check to the description paragraph specifically.
    const preview = screen.getByText(/See docs and run this\./);
    expect(preview.querySelector("a")).toBeNull();
    expect(preview.querySelector("code")).toBeNull();
  });
});

describe("BountyCard — deadline countdown (#216)", () => {
  it('shows "X days left" for a future deadline', () => {
    // formatDaysUntil (src/lib/utils.ts) is the actual, deliberate
    // implementation this renders through — properly pluralized ("1 day
    // left" vs "N days left"), not the abbreviated "Xd left" this test
    // previously (and incorrectly) expected.
    const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    render(<BountyCard bounty={makeBounty({ deadline })} />);
    expect(screen.getByText("5 days left")).toBeInTheDocument();
  });

  it('shows "Deadline passed" for a past deadline', () => {
    const deadline = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<BountyCard bounty={makeBounty({ deadline })} />);
    expect(screen.getByText("Deadline passed")).toBeInTheDocument();
  });
});

describe("BountyCard — status/difficulty badges (#216)", () => {
  it("renders the status and difficulty badges for a given bounty", () => {
    render(<BountyCard bounty={makeBounty({ status: "funded", difficulty: "advanced" })} />);
    expect(screen.getByText("Funded")).toBeInTheDocument();
    expect(screen.getByText("advanced")).toBeInTheDocument();
  });

  it('renders "In Review" for the in_review status, never the raw enum key', () => {
    // Was a lower-case "in review" here while BountyStatus.tsx independently
    // rendered "In Review" for the same enum — one bounty, two labels (#456).
    render(<BountyCard bounty={makeBounty({ status: "in_review" })} />);
    expect(screen.getByText("In Review")).toBeInTheDocument();
    expect(screen.queryByText("in_review")).not.toBeInTheDocument();
  });
});

describe("BountyCard — claimedBy line (#216)", () => {
  it("renders the claimedBy line when the bounty has been claimed", () => {
    render(<BountyCard bounty={makeBounty({ claimedBy: "devrel_ana" })} />);
    expect(screen.getByText(/claimed by devrel_ana/)).toBeInTheDocument();
  });

  it("omits the claimedBy line when the bounty is unclaimed", () => {
    render(<BountyCard bounty={makeBounty({ claimedBy: undefined })} />);
    expect(screen.queryByText(/claimed by/)).not.toBeInTheDocument();
  });
});

describe("BountyCard — reward (#216)", () => {
  it("renders the formatted reward and asset in the card header", () => {
    render(<BountyCard bounty={makeBounty({ reward: 1250, asset: "USDC" })} />);
    expect(screen.getByText("1,250 USDC")).toBeInTheDocument();
  });
});
