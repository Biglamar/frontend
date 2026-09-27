import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { BarChart } from "./BarChart";

expect.extend(toHaveNoViolations);

const DATA = [
  { label: "Week 1", value: 120 },
  { label: "Week 2", value: -40 },
  { label: "Week 3", value: 300 },
];

describe("BarChart accessibility", () => {
  it("has no automatically-detectable accessibility violations", async () => {
    const { container } = render(
      <BarChart data={DATA} formatValue={(v) => `$${v}`} title="Spend, last 3 weeks" />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("exposes every value as text in a screen-reader-available data table", () => {
    render(<BarChart data={DATA} formatValue={(v) => `$${v}`} title="Spend" />);

    // Visually hidden, not aria-hidden: sr-only, so it is still in the
    // accessibility tree and a screen reader reads the real figures.
    const table = screen.getByRole("table", { name: /Spend — data/ });
    expect(table).toBeInTheDocument();

    for (const { label, value } of DATA) {
      const row = screen.getByRole("row", { name: new RegExp(label) });
      expect(row).toHaveTextContent(`$${value}`);
    }
  });

  it("keeps the sign of a negative value, so it is not encoded by colour alone", () => {
    render(<BarChart data={DATA} formatValue={(v) => `$${v}`} title="Spend" />);

    expect(screen.getByRole("row", { name: /Week 2/ })).toHaveTextContent("$-40");
  });

  it("marks the visual bars decorative so values are not announced twice", () => {
    const { container } = render(<BarChart data={DATA} title="Spend" />);

    const bars = container.querySelectorAll("div[aria-hidden='true'] > div");
    expect(bars.length).toBeGreaterThan(0);
    // The bars are focusable for sighted keyboard users, but sit inside an
    // aria-hidden subtree so assistive tech relies on the table alone.
    const firstBar = container.querySelector<HTMLElement>("[tabindex='0']");
    expect(firstBar).toBeInTheDocument();
    expect(firstBar!.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("makes each bar keyboard focusable with a visible focus ring", () => {
    const { container } = render(<BarChart data={DATA} title="Spend" />);

    const focusable = container.querySelectorAll("[tabindex='0']");
    expect(focusable).toHaveLength(DATA.length);
    for (const bar of Array.from(focusable)) {
      expect(bar.className).toContain("focus-visible:outline-2");
    }
  });

  it("reveals the same tooltip on keyboard focus as on hover", () => {
    const { container } = render(
      <BarChart data={DATA} formatValue={(v) => `$${v}`} title="Spend" />,
    );

    const tooltip = container.querySelector("[aria-hidden='true'] span");
    expect(tooltip).toHaveTextContent("Week 1: $120");
    // group-focus-within is what makes the focus-reachable tooltip visible.
    expect(tooltip!.className).toContain("group-focus-within:opacity-100");
    expect(tooltip!.className).toContain("group-hover:opacity-100");
  });

  it("draws a stripe pattern on negative bars as a non-colour sign cue", () => {
    const { container } = render(<BarChart data={DATA} title="Spend" />);

    const bars = Array.from(container.querySelectorAll<HTMLElement>("[tabindex='0']"));
    expect(bars[1].style.backgroundImage).toContain("repeating-linear-gradient");
    expect(bars[0].style.backgroundImage).toBe("");
  });

  it("uses label colours that pass AA in both themes", () => {
    const { container } = render(<BarChart data={DATA} title="Spend" />);

    const label = Array.from(container.querySelectorAll("span")).find((s) =>
      s.textContent === "Week 1",
    )!;
    // slate-400/slate-500 measured 2.56:1 and 3.75:1 — both failed. The
    // current pair is slate-500 on white (4.76:1) and slate-400 on slate-900
    // (6.96:1).
    expect(label.className).toContain("text-slate-500");
    expect(label.className).toContain("dark:text-slate-400");
  });
});
