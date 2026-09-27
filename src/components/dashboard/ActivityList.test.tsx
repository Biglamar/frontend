/**
 * Tests for ActivityList's amount rendering (#87).
 *
 * `{event.amount && (...)}` renders a bare, unstyled "0" text node for a
 * legitimate `amount: 0` event, since `0 && x` evaluates to `0` itself, and
 * React renders a falsy-but-numeric expression result as literal text. The
 * fix guards on `typeof event.amount === "number"` instead, matching the
 * pattern already used correctly in StatCard's trend rendering.
 */

import { render, screen } from "@testing-library/react";
import { ActivityList } from "./ActivityList";
import type { ActivityEvent } from "@/lib/mock-data";

function agoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: "a1",
    handle: "devrel_ana",
    action: "was paid",
    target: "core-indexer#288",
    occurredAt: agoIso(6),
    ...overrides,
  };
}

describe("ActivityList — amount rendering", () => {
  it("renders a correctly-formatted amount for a genuine zero, not a bare '0' text node", () => {
    render(
      <ActivityList events={[makeEvent({ amount: 0, asset: "USDC" })]} />,
    );

    // The formatted "0 USDC" string must be present...
    expect(screen.getByText("0 USDC")).toBeInTheDocument();
    // ...and it must be the *only* place a lone "0" ever appears — no
    // stray, unstyled "0" sitting next to it outside that formatted string.
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
  });

  it("renders no amount text when amount is undefined (the non-monetary event case)", () => {
    render(<ActivityList events={[makeEvent({ action: "claimed" })]} />);

    expect(screen.queryByText(/USDC|XLM/)).not.toBeInTheDocument();
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
  });

  it("renders a genuine positive amount exactly as before", () => {
    render(
      <ActivityList events={[makeEvent({ amount: 480, asset: "USDC" })]} />,
    );

    expect(screen.getByText("480 USDC")).toBeInTheDocument();
  });
});

/**
 * Relative time is now produced by `Intl.RelativeTimeFormat` in the viewer's
 * locale (#456). The old expectations ("6m ago", "1h ago", "3d ago") came
 * from a hand-rolled English abbreviation ladder — grammatically wrong in
 * most languages and untranslatable, since "m"/"h"/"d" mean different things
 * in different locales. These pin the localized English form and the unit
 * boundaries it must keep.
 */
describe("ActivityList — relative time via Intl.RelativeTimeFormat (#217, #456)", () => {
  it("renders the minutes branch for a value under 60", () => {
    render(<ActivityList events={[makeEvent({ occurredAt: agoIso(6) })]} />);
    expect(screen.getByText("6 minutes ago")).toBeInTheDocument();
  });

  it("renders the minutes branch at the 59-minute boundary", () => {
    render(<ActivityList events={[makeEvent({ occurredAt: agoIso(59) })]} />);
    expect(screen.getByText("59 minutes ago")).toBeInTheDocument();
  });

  it("renders the hours branch at the 60-minute boundary", () => {
    render(<ActivityList events={[makeEvent({ occurredAt: agoIso(60) })]} />);
    expect(screen.getByText("1 hour ago")).toBeInTheDocument();
  });

  it("renders the hours branch for a mid-range value", () => {
    render(<ActivityList events={[makeEvent({ occurredAt: agoIso(300) })]} />);
    expect(screen.getByText("5 hours ago")).toBeInTheDocument();
  });

  it("renders the hours branch at the 23-hour boundary", () => {
    render(<ActivityList events={[makeEvent({ occurredAt: agoIso(23 * 60) })]} />);
    expect(screen.getByText("23 hours ago")).toBeInTheDocument();
  });

  it("renders the days branch at the 24-hour boundary", () => {
    render(<ActivityList events={[makeEvent({ occurredAt: agoIso(24 * 60) })]} />);
    // `numeric: "auto"` collapses a single day to "yesterday" per CLDR,
    // which is better copy than the "1d ago" this replaced.
    expect(screen.getByText("yesterday")).toBeInTheDocument();
  });

  it("truncates toward zero rather than rounding a past event up", () => {
    // 90 minutes is exactly -1.5 hours. `Math.round` is half-up, so on a
    // negative value that lands on -2 — reporting "2 hours ago" for something
    // an hour and a half old. Truncation keeps it at "1 hour ago" (#456).
    render(<ActivityList events={[makeEvent({ occurredAt: agoIso(90) })]} />);
    expect(screen.getByText("1 hour ago")).toBeInTheDocument();
  });

  it("renders the days branch for a multi-day value", () => {
    render(<ActivityList events={[makeEvent({ occurredAt: agoIso(3 * 24 * 60) })]} />);
    expect(screen.getByText("3 days ago")).toBeInTheDocument();
  });

  it("derives the relative time from occurredAt rather than a static value (#201)", () => {
    // Two renders 0 minutes apart with the same occurredAt should agree —
    // this just documents that the value comes from Date.now() - occurredAt
    // at render time, not from a field baked into the mock data.
    const occurredAt = agoIso(90);
    render(<ActivityList events={[makeEvent({ occurredAt })]} />);
    expect(screen.getByText("1 hour ago")).toBeInTheDocument();
  });
});

describe("ActivityList — empty feed (#456)", () => {
  // An empty list used to render the bordered card with zero rows inside it: a
  // visible empty box with no explanation. This is the only feed shared by all
  // three dashboards and the marketing home page.
  it("renders an explanatory empty state instead of an empty bordered box", () => {
    render(<ActivityList events={[]} />);

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Claims, reviews, and payouts across the platform/),
    ).toBeInTheDocument();
  });

  it("does not render the feed card chrome when there are no events", () => {
    const { container } = render(<ActivityList events={[]} />);

    expect(container.querySelector("ul")).not.toBeInTheDocument();
  });

  it("renders the feed list once there is at least one event", () => {
    const { container } = render(
      <ActivityList events={[makeEvent({ occurredAt: agoIso(5) })]} />,
    );

    expect(container.querySelector("ul")).toBeInTheDocument();
    expect(screen.queryByText("No activity yet")).not.toBeInTheDocument();
  });

  it("exposes each event timestamp as machine-readable <time>", () => {
    const occurredAt = agoIso(5);
    render(<ActivityList events={[makeEvent({ occurredAt })]} />);

    expect(screen.getByText("5 minutes ago").tagName).toBe("TIME");
    expect(screen.getByText("5 minutes ago")).toHaveAttribute("dateTime", occurredAt);
  });
});
