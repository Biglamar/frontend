/**
 * Footer.test.tsx
 *
 * Covers the Footer layout component: branding, navigation columns,
 * copyright line, and responsive layout structure.
 *
 * Test cases:
 *  1. Renders the MergeFi branding
 *  2. Renders Platform and Roles navigation columns
 *  3. Renders all expected links in each column
 *  4. Renders the copyright line with CopyrightYear
 *  5. Renders the tagline
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

// ─── 1. Branding ─────────────────────────────────────────────────────────────

describe("Footer — branding", () => {
  it("renders the MergeFi name", () => {
    render(<Footer />);
    expect(screen.getByText("MergeFi")).toBeInTheDocument();
  });

  it("renders the tagline description", () => {
    render(<Footer />);
    expect(screen.getByText(/financial infrastructure for open source/i)).toBeInTheDocument();
  });

  it("renders the tagline at the bottom", () => {
    render(<Footer />);
    expect(screen.getByText("Where open source meets finance.")).toBeInTheDocument();
  });
});

// ─── 2. Navigation columns ───────────────────────────────────────────────────

describe("Footer — navigation", () => {
  it("renders the Platform column", () => {
    render(<Footer />);
    expect(screen.getByText("Platform")).toBeInTheDocument();
  });

  it("renders the Roles column", () => {
    render(<Footer />);
    expect(screen.getByText("Roles")).toBeInTheDocument();
  });

  it("renders Platform links", () => {
    render(<Footer />);
    expect(screen.getByText("Browse bounties")).toBeInTheDocument();
    expect(screen.getByText("Milestones")).toBeInTheDocument();
    expect(screen.getByText("Connect GitHub")).toBeInTheDocument();
  });

  it("renders Roles links", () => {
    render(<Footer />);
    expect(screen.getByText("Contributors")).toBeInTheDocument();
    expect(screen.getByText("Maintainers")).toBeInTheDocument();
    expect(screen.getByText("Sponsors")).toBeInTheDocument();
  });

  it("links have correct hrefs", () => {
    render(<Footer />);
    expect(screen.getByText("Browse bounties").closest("a")).toHaveAttribute("href", "/issues");
    expect(screen.getByText("Milestones").closest("a")).toHaveAttribute("href", "/milestones");
    expect(screen.getByText("Connect GitHub").closest("a")).toHaveAttribute("href", "/connect");
    expect(screen.getByText("Contributors").closest("a")).toHaveAttribute("href", "/dashboard/contributor");
    expect(screen.getByText("Maintainers").closest("a")).toHaveAttribute("href", "/dashboard/maintainer");
    expect(screen.getByText("Sponsors").closest("a")).toHaveAttribute("href", "/dashboard/sponsor");
  });
});

// ─── 3. Copyright ────────────────────────────────────────────────────────────

describe("Footer — copyright", () => {
  it("renders the copyright line with the CopyrightYear component", () => {
    render(<Footer />);
    // The copyright line contains "MergeFi. All rights reserved."
    expect(screen.getByText(/MergeFi\. All rights reserved\./)).toBeInTheDocument();
  });
});

// ─── 4. Structure ────────────────────────────────────────────────────────────

describe("Footer — structure", () => {
  it("renders as a footer element", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
