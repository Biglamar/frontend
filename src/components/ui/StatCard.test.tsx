/**
 * StatCard.test.tsx
 *
 * Covers all four explicit states (loading, error, zero, loaded) plus
 * large-number scaling and pre-formatted string pass-through.
 *
 * Test cases:
 *  1. Loading state — skeleton visible, no value text
 *  2. Error state — em-dash + "Error loading data", ARIA label
 *  3. Zero state (numeric 0) — "0" rendered, zeroLabel shown, trend hidden
 *  4. Zero-as-string — must NOT trigger zero-state treatment
 *  5. Typical loaded value — renders correctly, trend shown
 *  6. Large financial value — shorter font class applied, title tooltip present
 *  7. Pre-formatted string — passed through unchanged
 *  8. Negative currency values — sign preserved, consistent with formatCurrency
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { StatCard } from "./StatCard";
import { formatCurrency } from "@/lib/utils";

// ─── 1. Loading state ────────────────────────────────────────────────────────

describe("StatCard — loading state", () => {
  it("renders a skeleton and hides the value", () => {
    const { container } = render(<StatCard label="Lifetime earnings" status="loading" />);
    expect(screen.getByTestId("statcard-skeleton")).toBeInTheDocument();
    // No numeric/text value should be visible while loading
    expect(screen.queryByTestId("statcard-value")).not.toBeInTheDocument();
    expect(screen.queryByTestId("statcard-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("statcard-zero")).not.toBeInTheDocument();
    // Skeleton carries the pulse animation class
    expect(container.querySelector("[data-testid='statcard-skeleton']")).toHaveClass(
      "animate-pulse",
    );
  });
});

// ─── 2. Error state ──────────────────────────────────────────────────────────

describe("StatCard — error state", () => {
  it("renders the error indicator with correct text and ARIA label", () => {
    render(<StatCard label="Locked in escrow" status="error" />);
    const errorEl = screen.getByTestId("statcard-error");
    expect(errorEl).toBeInTheDocument();
    // Em-dash must be visible — not a zero or blank
    expect(errorEl).toHaveTextContent("—");
    // Sub-label wording
    expect(errorEl).toHaveTextContent("Error loading data");
    // Wrapper region is labelled for screen readers — prevents SR from
    // announcing the card as just "Locked in escrow" with no context
    const region = screen.getByRole("region", { name: /Error loading data/i });
    expect(region).toBeInTheDocument();
  });

  it("never renders a zero value that could be mistaken for a real figure", () => {
    render(<StatCard label="Total paid out" status="error" value={0} format="currency" />);
    expect(screen.queryByTestId("statcard-value")).not.toBeInTheDocument();
    expect(screen.queryByTestId("statcard-zero")).not.toBeInTheDocument();
    expect(screen.getByTestId("statcard-error")).toBeInTheDocument();
  });
});

// ─── 3. Zero state — numeric 0 ───────────────────────────────────────────────

describe("StatCard — zero state (numeric 0)", () => {
  it("renders a deliberate zero with the default zeroLabel", () => {
    render(
      <StatCard label="Lifetime earnings" status="loaded" value={0} format="currency" />,
    );
    const zeroEl = screen.getByTestId("statcard-zero");
    expect(zeroEl).toBeInTheDocument();
    // The value "0 USDC" must be present and readable
    expect(zeroEl).toHaveTextContent("0");
    // Default sub-label
    expect(zeroEl).toHaveTextContent("No activity yet");
    // Trend must NOT appear on a zero value (no misleading "0% vs last period")
    expect(screen.queryByText(/vs last period/i)).not.toBeInTheDocument();
  });

  it("uses a custom zeroLabel when provided", () => {
    render(
      <StatCard
        label="Active bounties"
        status="loaded"
        value={0}
        format="count"
        zeroLabel="No bounties yet"
      />,
    );
    expect(screen.getByTestId("statcard-zero")).toHaveTextContent("No bounties yet");
  });
});

// ─── 4. Zero-as-string — must NOT trigger zero-state ─────────────────────────

describe("StatCard — zero-as-string pass-through", () => {
  it('renders "0" string as a normal loaded value, not the zero-state', () => {
    // "0" as a string means the caller has pre-formatted the value.
    // We must not second-guess it and show the zero-state — that would
    // incorrectly suppress the value for things like "0%" completion rate
    // that the caller explicitly formatted.
    render(<StatCard label="Completion rate" status="loaded" value="0%" />);
    // Normal value node should appear
    expect(screen.getByTestId("statcard-value")).toBeInTheDocument();
    expect(screen.getByTestId("statcard-value")).toHaveTextContent("0%");
    // Zero-state node must NOT appear
    expect(screen.queryByTestId("statcard-zero")).not.toBeInTheDocument();
  });
});

// ─── 5. Typical loaded value ──────────────────────────────────────────────────

describe("StatCard — typical loaded value", () => {
  it("renders value and trend correctly", () => {
    render(
      <StatCard
        label="Lifetime earnings"
        status="loaded"
        value={8420}
        format="currency"
        trend={12}
      />,
    );
    const valueEl = screen.getByTestId("statcard-value");
    expect(valueEl).toBeInTheDocument();
    // Locale-formatted + asset suffix
    expect(valueEl).toHaveTextContent("8,420 USDC");
    // Trend rendered
    expect(screen.getByText(/12% vs last period/i)).toBeInTheDocument();
  });

  it("does not render trend when trend prop is absent", () => {
    render(<StatCard label="Repositories" status="loaded" value={4} format="count" />);
    expect(screen.queryByText(/vs last period/i)).not.toBeInTheDocument();
  });
});

// ─── 6. Large financial value ─────────────────────────────────────────────────

describe("StatCard — large number handling", () => {
  it("applies a smaller font class for a long value string", () => {
    render(
      <StatCard
        label="Total paid out"
        status="loaded"
        value={1_284_999}
        format="currency"
      />,
    );
    const valueEl = screen.getByTestId("statcard-value");
    // "1,284,999 USDC" is 14 chars → should get text-xl (not text-2xl)
    expect(valueEl.className).toMatch(/text-xl/);
    // Must NOT have the default large class
    expect(valueEl.className).not.toMatch(/text-2xl/);
  });

  it("exposes the full exact value via title tooltip", () => {
    render(
      <StatCard
        label="Total paid out"
        status="loaded"
        value={1_284_999}
        format="currency"
      />,
    );
    const valueEl = screen.getByTestId("statcard-value");
    // Title attribute must be present with the unabbreviated figure
    expect(valueEl).toHaveAttribute("title");
    const title = valueEl.getAttribute("title") ?? "";
    // Must contain the full number — no "1.3M" abbreviation
    expect(title).toContain("1,284,999");
  });
});

// ─── 7. Pre-formatted string pass-through ────────────────────────────────────

describe("StatCard — pre-formatted string value", () => {
  it("passes a pre-formatted string through without modification", () => {
    render(<StatCard label="Completion rate" status="loaded" value="94%" />);
    const valueEl = screen.getByTestId("statcard-value");
    expect(valueEl).toHaveTextContent("94%");
    // No extra USDC suffix should be appended
    expect(valueEl).not.toHaveTextContent("USDC");
  });
});

// ─── 8. Negative currency values ─────────────────────────────────────────────

describe("StatCard — negative currency values (issue #90)", () => {
  it("renders negative currency values with a minus sign", () => {
    render(
      <StatCard
        label="Net balance"
        status="loaded"
        value={-50}
        format="currency"
      />,
    );
    const valueEl = screen.getByTestId("statcard-value");
    expect(valueEl).toBeInTheDocument();
    // Must contain a minus sign
    expect(valueEl).toHaveTextContent("-50 USDC");
  });

  it("distinguishes negative from positive for the same absolute value", () => {
    const { rerender } = render(
      <StatCard
        label="Balance"
        status="loaded"
        value={-50}
        format="currency"
      />,
    );
    const negativeText = screen.getByTestId("statcard-value").textContent;

    rerender(
      <StatCard
        label="Balance"
        status="loaded"
        value={50}
        format="currency"
      />,
    );
    const positiveText = screen.getByTestId("statcard-value").textContent;

    expect(negativeText).not.toBe(positiveText);
    expect(negativeText).toContain("-");
    expect(positiveText).not.toContain("-");
  });

  it("agrees with formatCurrency for negative values", () => {
    // This test ensures StatCard's internal currency formatter and
    // the standalone formatCurrency function produce identical output
    // for negative amounts, resolving the inconsistency in issue #90.
    render(
      <StatCard
        label="Net balance"
        status="loaded"
        value={-50}
        format="currency"
        asset="USDC"
      />,
    );
    const statCardOutput = screen.getByTestId("statcard-value").textContent;
    const formatCurrencyOutput = formatCurrency(-50, "USDC");

    expect(statCardOutput).toBe(formatCurrencyOutput);
  });

  it("renders negative XLM amounts correctly", () => {
    render(
      <StatCard
        label="XLM balance"
        status="loaded"
        value={-123.45}
        format="currency"
        asset="XLM"
      />,
    );
    const valueEl = screen.getByTestId("statcard-value");
    expect(valueEl).toHaveTextContent("-123.45 XLM");
  });

  it("renders negative trend values with correct styling", () => {
    render(
      <StatCard
        label="Budget remaining"
        status="loaded"
        value={-200}
        format="currency"
        trend={-15}
      />,
    );
    // Value should show as negative
    expect(screen.getByTestId("statcard-value")).toHaveTextContent("-200 USDC");
    // Trend should show as negative with appropriate styling
    expect(screen.getByText(/15% vs last period/i)).toBeInTheDocument();
  });
});

// ─── 9. Icon rendering (#218) ─────────────────────────────────────────────────

describe("StatCard — icon", () => {
  it("renders the icon when provided", () => {
    render(<StatCard label="Lifetime earnings" status="loaded" value={100} icon={Wallet} />);
    const iconWrapper = screen.getByTestId("statcard-icon");
    expect(iconWrapper.querySelector("svg")).not.toBeNull();
  });

  it("renders no icon wrapper when icon is omitted", () => {
    render(<StatCard label="Lifetime earnings" status="loaded" value={100} />);
    expect(screen.queryByTestId("statcard-icon")).not.toBeInTheDocument();
  });
});

// ─── 10. Sparkline rendering (#218) ───────────────────────────────────────────

describe("StatCard — sparkline", () => {
  it("renders no sparkline wrapper when sparkline is omitted", () => {
    render(<StatCard label="Earnings history" status="loaded" value={100} />);
    expect(screen.queryByTestId("statcard-sparkline")).not.toBeInTheDocument();
  });

  it("renders no sparkline wrapper for an empty array, avoiding an empty layout gap (#207)", () => {
    render(<StatCard label="Earnings history" status="loaded" value={100} sparkline={[]} />);
    // [] is truthy, but Sparkline itself draws nothing for < 2 points, so
    // StatCard must check length too — not just presence — or it leaves an
    // empty, unexplained gap in the row.
    expect(screen.queryByTestId("statcard-sparkline")).not.toBeInTheDocument();
  });

  it("renders no sparkline wrapper for a single-element array (#207)", () => {
    render(<StatCard label="Earnings history" status="loaded" value={100} sparkline={[42]} />);
    expect(screen.queryByTestId("statcard-sparkline")).not.toBeInTheDocument();
  });

  it("renders the chart for a multi-element array", () => {
    render(
      <StatCard label="Earnings history" status="loaded" value={100} sparkline={[10, 20, 15, 30]} />,
    );
    const wrapper = screen.getByTestId("statcard-sparkline");
    expect(wrapper.querySelector("svg")).not.toBeNull();
  });

  it("names the sparkline after the card's own label", () => {
    render(
      <StatCard label="Earnings history" status="loaded" value={100} sparkline={[10, 20, 15, 30]} />,
    );
    // The stat card is the only place that knows what the trend represents, so
    // it has to supply the name — otherwise the sparkline announces as an
    // unlabelled graphic.
    const svg = screen.getByRole("img");
    expect(svg).toHaveAccessibleName(
      "Earnings history: 4 data points, trending up from 10 to 30, range 10 to 30",
    );
  });
});
