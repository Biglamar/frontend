import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { Sparkline, describeTrend } from "./Sparkline";

expect.extend(toHaveNoViolations);

const RISING = [12, 18, 14, 22, 19, 27, 24, 31];

describe("Sparkline accessibility", () => {
  it("has no automatically-detectable accessibility violations", async () => {
    const { container } = render(<Sparkline data={RISING} label="Earnings" />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("is exposed as an image with a descriptive name, not hidden", () => {
    render(<Sparkline data={RISING} label="Earnings" />);

    const svg = screen.getByRole("img");
    expect(svg).toHaveAccessibleName(
      "Earnings: 8 data points, trending up from 12 to 31, range 12 to 31",
    );
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("hides the decorative polylines from assistive tech", () => {
    const { container } = render(<Sparkline data={RISING} label="Earnings" />);

    const polylines = container.querySelectorAll("polyline");
    expect(polylines).toHaveLength(2);
    for (const polyline of Array.from(polylines)) {
      expect(polyline.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("still renders nothing for fewer than two points", () => {
    const { container } = render(<Sparkline data={[5]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("describeTrend", () => {
  it("names the subject when one is given", () => {
    expect(describeTrend([1, 2, 3], "Earnings")).toContain("Earnings:");
  });

  it("omits the subject when none is given", () => {
    expect(describeTrend([1, 2, 3])).toBe(
      "3 data points, trending up from 1 to 3, range 1 to 3",
    );
  });

  it.each([
    [[1, 2, 3], "up"],
    [[3, 2, 1], "down"],
    [[2, 2, 2], "flat"],
  ])("reports %p as trending %s", (data, direction) => {
    expect(describeTrend(data as number[], "Trend")).toContain(
      `trending ${direction}`,
    );
  });

  it("reports the full range, not just the endpoints", () => {
    expect(describeTrend([5, 100, 5], "Earnings")).toContain("range 5 to 100");
  });

  it("uses a custom formatter for every figure it reads out", () => {
    const text = describeTrend([10, 20], "Balance", (v) => `$${v}.00`);

    expect(text).toContain("from $10.00 to $20.00");
    expect(text).toContain("range $10.00 to $20.00");
  });

  it("handles a flat series without dividing by zero", () => {
    expect(describeTrend([7, 7, 7], "Steady")).toContain("trending flat");
  });
});
