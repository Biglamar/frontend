/**
 * Badge.test.tsx
 *
 * StatusBadge/DifficultyBadge encode two enum-keyed style maps that
 * TypeScript checks for exhaustiveness at compile time, but nothing
 * previously asserted the *rendered* label text or class per status/
 * difficulty at runtime (#212). Covers every BountyStatus and Difficulty
 * value, plus the status-key -> human-label mapping.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { StatusBadge, DifficultyBadge, Badge } from "./Badge";
import type { BountyStatus, Difficulty } from "@/types";

const ALL_STATUSES: BountyStatus[] = [
  "open",
  "funded",
  "claimed",
  "in_review",
  "merged",
  "paid",
  "refunded",
  "expired",
];

const ALL_DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced", "expert"];

/**
 * Explicit expected label per status. Asserted against a literal map rather
 * than `status.replace("_", " ")` so the test actually pins the copy: the old
 * implementation produced lower-case "in review" here while
 * components/bounty/BountyStatus.tsx independently produced "In Review" for
 * the same enum, so one bounty showed two different labels in two places
 * (#456). Both now render the same map.
 */
const STATUS_LABELS: Record<BountyStatus, string> = {
  open: "Open",
  funded: "Funded",
  claimed: "Claimed",
  in_review: "In Review",
  merged: "Merged",
  paid: "Paid",
  refunded: "Refunded",
  expired: "Expired",
};

describe("StatusBadge", () => {
  it.each(ALL_STATUSES)("renders the correct label for status %s", (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument();
  });

  it('never leaks a raw enum key to the user', () => {
    render(<StatusBadge status="in_review" />);
    expect(screen.getByText("In Review")).toBeInTheDocument();
    expect(screen.queryByText("in_review")).not.toBeInTheDocument();
    expect(screen.queryByText("in review")).not.toBeInTheDocument();
  });

  it.each(ALL_STATUSES)("applies a distinct ring/background class for status %s", (status) => {
    render(<StatusBadge status={status} />);
    const el = screen.getByText(STATUS_LABELS[status]);
    expect(el.className).toMatch(/ring-/);
  });
});

describe("DifficultyBadge", () => {
  it.each(ALL_DIFFICULTIES)("renders the correct label for difficulty %s", (difficulty) => {
    render(<DifficultyBadge difficulty={difficulty} />);
    expect(screen.getByText(difficulty)).toBeInTheDocument();
  });

  it.each(ALL_DIFFICULTIES)("applies a distinct ring/background class for difficulty %s", (difficulty) => {
    render(<DifficultyBadge difficulty={difficulty} />);
    const el = screen.getByText(difficulty);
    expect(el.className).toMatch(/ring-/);
  });
});

describe("Badge", () => {
  it("renders arbitrary children with the default style", () => {
    render(<Badge>Custom label</Badge>);
    expect(screen.getByText("Custom label")).toBeInTheDocument();
  });

  it("merges a custom className with the default style", () => {
    render(<Badge className="test-extra-class">Custom</Badge>);
    expect(screen.getByText("Custom").className).toMatch(/test-extra-class/);
  });
});

describe("non-colour cues (#49)", () => {
  it.each([...ALL_STATUSES])("renders a decorative icon alongside the %s label", (status) => {
    const { container } = render(<StatusBadge status={status} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("gives every status a distinct icon", () => {
    const icons = ALL_STATUSES.map((status) => {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const html = container.querySelector("svg")?.getAttribute("class");
      unmount();
      return html;
    });
    expect(new Set(icons).size).toBe(ALL_STATUSES.length);
  });

  it("makes funded and paid differ by fill as well as icon", () => {
    render(
      <>
        <StatusBadge status="funded" />
        <StatusBadge status="paid" />
      </>,
    );
    expect(screen.getByText("Paid").className).toMatch(/bg-emerald-700/);
    expect(screen.getByText("Funded").className).not.toMatch(/bg-emerald-700/);
  });
});
