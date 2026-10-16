/**
 * Tests for reputation/[handle] page — extracted ReputationProfileView (#412).
 *
 * Covers: case-insensitive handle lookup, empty-state branches for
 * organizations and languages.
 */

import { render, screen } from "@testing-library/react";
import { ReputationProfileView } from "./ReputationProfileView";
import type { ReputationProfile } from "@/types";

function makeProfile(overrides: Partial<ReputationProfile> = {}): ReputationProfile {
  return {
    handle: "testuser",
    avatarUrl: "https://example.com/avatar.png",
    lifetimeEarnings: 1000,
    mergedPRs: 10,
    completionRate: 0.9,
    avgReviewTimeHours: 12,
    onTimeDeliveryRate: 0.85,
    languages: ["TypeScript"],
    organizations: ["test-org"],
    ...overrides,
  };
}

describe("ReputationProfileView — empty states", () => {
  it("renders the organizations fallback when organizations is empty", () => {
    render(<ReputationProfileView profile={makeProfile({ organizations: [] })} />);
    expect(
      screen.getByText("No organizations recorded yet."),
    ).toBeInTheDocument();
  });

  it("renders the languages fallback when languages is empty", () => {
    render(<ReputationProfileView profile={makeProfile({ languages: [] })} />);
    expect(screen.getByText("No languages recorded yet.")).toBeInTheDocument();
  });

  it("renders org badges when organizations is non-empty", () => {
    render(<ReputationProfileView profile={makeProfile({ organizations: ["stellar-labs", "mergefi"] })} />);
    expect(screen.getByText("stellar-labs")).toBeInTheDocument();
    expect(screen.getByText("mergefi")).toBeInTheDocument();
    expect(
      screen.queryByText("No organizations recorded yet."),
    ).not.toBeInTheDocument();
  });

  it("renders language badges when languages is non-empty", () => {
    render(<ReputationProfileView profile={makeProfile({ languages: ["Rust", "Go"] })} />);
    expect(screen.getByText("Rust")).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(screen.queryByText("No languages recorded yet.")).not.toBeInTheDocument();
  });
});

describe("ReputationProfileView — handle display", () => {
  it("renders the handle with @ prefix", () => {
    render(<ReputationProfileView profile={makeProfile({ handle: "priyaeth" })} />);
    expect(screen.getByText(/@priyaeth/)).toBeInTheDocument();
  });
});

describe("ReputationProfileView — stats", () => {
  it("renders stat cards with profile data", () => {
    render(<ReputationProfileView profile={makeProfile({ mergedPRs: 42 })} />);
    expect(screen.getByText("Merged PRs")).toBeInTheDocument();
    expect(screen.getByText("Lifetime earnings")).toBeInTheDocument();
  });

  it("renders average review time", () => {
    render(<ReputationProfileView profile={makeProfile({ avgReviewTimeHours: 12 })} />);
    expect(screen.getByText(/Average review time/)).toBeInTheDocument();
  });
});

describe("ReputationProfileView — a contributor with no merged PRs yet (#456)", () => {
  // A brand-new contributor is a real, reachable state. It used to render as
  // four StatCards each showing "0" / "No activity yet" plus two bare grey
  // spans, with no single consolidated explanation and no way forward.
  const unproven = { mergedPRs: 0, lifetimeEarnings: 0, languages: [], organizations: [] };

  it("shows an encouraging empty state with a next step", () => {
    render(<ReputationProfileView profile={makeProfile(unproven)} />);

    expect(screen.getByText("No merged pull requests yet")).toBeInTheDocument();
    expect(
      screen.getByText(/A single merged bounty claim is enough to start building/),
    ).toBeInTheDocument();
    expect(screen.getByText("Browse open bounties").closest("a")).toHaveAttribute(
      "href",
      "/issues",
    );
  });

  it("does not show it for a contributor with merge history", () => {
    render(
      <ReputationProfileView profile={makeProfile({ mergedPRs: 3, lifetimeEarnings: 120 })} />,
    );

    expect(screen.queryByText("No merged pull requests yet")).not.toBeInTheDocument();
  });

  it("does not show it for a contributor who has earned but not yet merged", () => {
    // Earnings with no merged PRs is a different situation (a pending claim),
    // not an unproven profile.
    render(
      <ReputationProfileView profile={makeProfile({ mergedPRs: 0, lifetimeEarnings: 250 })} />,
    );

    expect(screen.queryByText("No merged pull requests yet")).not.toBeInTheDocument();
  });

  it("gives the zero StatCards a specific label rather than the generic default", () => {
    render(<ReputationProfileView profile={makeProfile(unproven)} />);

    expect(screen.getAllByText("No merged PRs yet").length).toBeGreaterThan(0);
    expect(screen.queryByText("No activity yet")).not.toBeInTheDocument();
  });
});
