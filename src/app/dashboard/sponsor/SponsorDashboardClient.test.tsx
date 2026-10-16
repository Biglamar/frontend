/**
 * SponsorDashboardClient.test.tsx
 *
 * Covers the error-vs-zero logic in SponsorDashboardClient: on fetch failure
 * the component sets data=null + fetchStatus="error" (NOT values to 0), so
 * StatCards show an error state rather than a false zero balance.
 *
 * Test cases:
 *  1. Renders demo data when signed out (loading=false, user=null)
 *  2. Shows loading skeletons while auth is loading
 *  3. On API error: sets fetchStatus to "error", data stays null (no zeros)
 *  4. On API success: shows live data and "Live data" badge
 *  5. Demo mode shows "Demo data" badge
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// Mock the auth context
const mockUseAuth = jest.fn();
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock the api module
const mockApiRequest = jest.fn();
jest.mock("@/lib/api", () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

// Mock the adapters module
jest.mock("@/lib/adapters", () => ({
  adaptBounty: (raw: any) => raw,
  adaptMilestone: (raw: any) => raw,
}));

// Mock DashboardShell to avoid complex nesting
jest.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children, badge }: any) => (
    <div data-testid="dashboard-shell">
      {badge}
      {children}
    </div>
  ),
}));

// Mock other heavy components
jest.mock("@/components/bounty/BountyCard", () => ({
  BountyCard: ({ bounty }: any) => <div data-testid="bounty-card">{bounty.title}</div>,
}));

jest.mock("@/components/dashboard/ActivityList", () => ({
  ActivityList: () => <div data-testid="activity-list" />,
}));

jest.mock("@/components/ui/BarChart", () => ({
  BarChart: () => <div data-testid="bar-chart" />,
}));

jest.mock("@/components/ui/StatCard", () => ({
  StatCard: ({ label, status, value }: any) => (
    <div data-testid="stat-card" data-label={label} data-status={status}>
      {status === "loaded" && value !== undefined ? String(value) : ""}
    </div>
  ),
}));

jest.mock("@/components/ui/EmptyState", () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

import SponsorDashboardClient from "./SponsorDashboardClient";

// ─── 1. Demo mode (signed out) ──────────────────────────────────────────────

describe("SponsorDashboardClient — demo mode (signed out)", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockApiRequest.mockReset();
  });

  it("renders demo data and shows Demo data badge", async () => {
    render(<SponsorDashboardClient />);
    await waitFor(() => {
      expect(screen.getByText("Demo data")).toBeInTheDocument();
    });
  });

  it("shows sample data subtitle in demo mode", async () => {
    render(<SponsorDashboardClient />);
    await waitFor(() => {
      expect(screen.getByText(/sample data for now/i)).toBeInTheDocument();
    });
  });
});

// ─── 2. Loading state ────────────────────────────────────────────────────────

describe("SponsorDashboardClient — loading state", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    mockApiRequest.mockReset();
  });

  it("does not fetch while auth is loading", async () => {
    render(<SponsorDashboardClient />);
    // API should not be called while loading
    expect(mockApiRequest).not.toHaveBeenCalled();
  });
});

// ─── 3. Error state (the key regression test) ────────────────────────────────

describe("SponsorDashboardClient — error state (#616)", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", username: "sponsor", displayName: "Sponsor" },
      loading: false,
    });
    mockApiRequest.mockReset();
  });

  it("sets fetchStatus to error and data to null on API failure", async () => {
    mockApiRequest.mockRejectedValue(new Error("Network error"));

    render(<SponsorDashboardClient />);

    await waitFor(() => {
      const statCards = screen.getAllByTestId("stat-card");
      // All cards should be in error status
      statCards.forEach((card) => {
        expect(card).toHaveAttribute("data-status", "error");
      });
    });
  });

  it("does NOT show zero values on error (trust-eroding false signal)", async () => {
    mockApiRequest.mockRejectedValue(new Error("Network error"));

    render(<SponsorDashboardClient />);

    await waitFor(() => {
      const statCards = screen.getAllByTestId("stat-card");
      // Error status means no value should be rendered
      statCards.forEach((card) => {
        expect(card.textContent).toBe("");
      });
    });
  });

  it("shows Live data badge even on error (data is live, just failed)", async () => {
    mockApiRequest.mockRejectedValue(new Error("Network error"));

    render(<SponsorDashboardClient />);

    await waitFor(() => {
      expect(screen.getByText("Live data")).toBeInTheDocument();
    });
  });
});

// ─── 4. Success state ────────────────────────────────────────────────────────

describe("SponsorDashboardClient — success state", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", username: "sponsor", displayName: "Sponsor" },
      loading: false,
    });
    mockApiRequest.mockReset();
  });

  it("shows Live data badge on success", async () => {
    mockApiRequest.mockResolvedValue({
      activeBounties: [],
      totalSpent: 1000,
      budgetLocked: 500,
      activeMilestones: [],
    });

    render(<SponsorDashboardClient />);

    await waitFor(() => {
      expect(screen.getByText("Live data")).toBeInTheDocument();
    });
  });

  it("shows loaded values on success", async () => {
    mockApiRequest.mockResolvedValue({
      activeBounties: [],
      totalSpent: 1000,
      budgetLocked: 500,
      activeMilestones: [],
    });

    render(<SponsorDashboardClient />);

    await waitFor(() => {
      const statCards = screen.getAllByTestId("stat-card");
      statCards.forEach((card) => {
        expect(card).toHaveAttribute("data-status", "loaded");
      });
    });
  });
});
