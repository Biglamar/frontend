/**
 * page.test.tsx (#617)
 *
 * Covers the HomePage Server Component: renders key sections, CTA links,
 * and the mock-data fallback when the backend is unreachable.
 */

import { render, screen } from "@testing-library/react";
import HomePage from "./page";

// Mock fetch so the backend is "unreachable" → mock stats fallback path.
beforeEach(() => {
  global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("HomePage", () => {
  it("renders the hero heading", async () => {
    render(await HomePage());
    expect(screen.getByText("Merge code.")).toBeInTheDocument();
    expect(screen.getByText("Earn instantly.")).toBeInTheDocument();
  });

  it("renders CTA links to issues and connect", async () => {
    render(await HomePage());
    expect(
      screen.getByRole("link", { name: /Browse paid issues/ }),
    ).toHaveAttribute("href", "/issues");
    expect(
      screen.getByRole("link", { name: /Sponsor a repository/ }),
    ).toHaveAttribute("href", "/connect");
  });

  it("renders platform stats section", async () => {
    render(await HomePage());
    expect(screen.getByText("Total paid out")).toBeInTheDocument();
    expect(screen.getByText("Bounties completed")).toBeInTheDocument();
    expect(screen.getByText("Active contributors")).toBeInTheDocument();
    expect(screen.getByText("Avg. payout time")).toBeInTheDocument();
  });

  it("renders features section", async () => {
    render(await HomePage());
    expect(screen.getByText("Repository sync")).toBeInTheDocument();
    expect(screen.getByText("Smart escrow")).toBeInTheDocument();
    expect(screen.getByText("Instant payouts")).toBeInTheDocument();
  });

  it("renders the journey steps", async () => {
    render(await HomePage());
    expect(
      screen.getByText(/Maintainer connects a GitHub repository/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/escrow contract automatically releases payment/),
    ).toBeInTheDocument();
  });

  it("renders FAQ section", async () => {
    render(await HomePage());
    expect(screen.getByText("Common questions")).toBeInTheDocument();
  });

  it("renders the Stellar section", async () => {
    render(await HomePage());
    expect(screen.getByText("Why Stellar and Soroban?")).toBeInTheDocument();
  });

  it("shows the mock-data notice when backend is unreachable", async () => {
    render(await HomePage());
    // DataSourceNotice is rendered when statsSource === "mock"
    expect(screen.getByText(/sample data/i)).toBeInTheDocument();
  });
});
