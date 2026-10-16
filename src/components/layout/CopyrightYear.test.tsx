/**
 * CopyrightYear.test.tsx
 *
 * Covers the CopyrightYear client component that renders the current year
 * and self-corrects stale build-time years on hydration (#221).
 *
 * Test cases:
 *  1. Renders the current year as text
 *  2. Hydration effect corrects a stale build-time year
 *  3. Renders only a number, no extra markup
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import { CopyrightYear } from "./CopyrightYear";

// ─── 1. Renders current year ─────────────────────────────────────────────────

describe("CopyrightYear — basic rendering", () => {
  it("renders the current year", () => {
    render(<CopyrightYear />);
    const expected = new Date().getFullYear().toString();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders only the year as text, no extra elements", () => {
    const { container } = render(<CopyrightYear />);
    // Should be a bare fragment rendering just the number
    expect(container.textContent).toBe(new Date().getFullYear().toString());
  });
});

// ─── 2. Hydration correction ─────────────────────────────────────────────────

describe("CopyrightYear — hydration correction", () => {
  it("re-reads the year on mount via useEffect", () => {
    // Mock Date to simulate a stale year on first render, then correct it
    const originalDate = Date;
    const staleYear = 2020;
    const realYear = 2025;

    // First call (useState initial value) returns stale year,
    // subsequent calls (useEffect) return the real year
    let callCount = 0;
    class MockDate extends Date {
      constructor(...args: any[]) {
        if (args.length === 0 && callCount === 0) {
          callCount++;
          super(realYear, 0, 1);
        } else if (args.length === 0) {
          super(realYear, 0, 1);
        } else {
          // @ts-expect-error - spread for constructor
          super(...args);
        }
      }
      getFullYear() {
        return callCount <= 1 ? staleYear : realYear;
      }
    }

    (global as any).Date = MockDate;
    try {
      render(<CopyrightYear />);
      // Initially might show stale year, but effect should correct it
      // After the effect runs, we should see the real year
      const el = screen.getByText(String(realYear));
      expect(el).toBeInTheDocument();
    } finally {
      (global as any).Date = originalDate;
    }
  });
});
