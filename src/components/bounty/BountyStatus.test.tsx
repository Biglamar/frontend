/**
 * BountyStatus.test.tsx
 *
 * Covers the BountyStatus component: status badge rendering, loading state,
 * error state with retry, live/polling indicators, mock data badge, and
 * claimed-by display (#657).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { BountyStatus } from "./BountyStatus";
import { useBountyStatus } from "@/hooks/useBountyStatus";

jest.mock("@/hooks/useBountyStatus");

const mockUseBountyStatus = useBountyStatus as jest.MockedFunction<typeof useBountyStatus>;

const defaultMock = {
  bounty: { id: "1", status: "open", claimedBy: null },
  isLoading: false,
  error: null,
  isPolling: false,
  isLive: true,
  status: "open" as const,
  source: "live" as const,
  refetch: jest.fn(),
};

describe("BountyStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBountyStatus.mockReturnValue(defaultMock);
  });

  it("renders the status badge with the correct label", () => {
    render(<BountyStatus bountyId="1" />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("shows a loading skeleton when isLoading is true and no bounty", () => {
    mockUseBountyStatus.mockReturnValue({ ...defaultMock, isLoading: true, bounty: null });
    const { container } = render(<BountyStatus bountyId="1" />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows an error message with a retry button when error is set", () => {
    mockUseBountyStatus.mockReturnValue({ ...defaultMock, error: new Error("fail"), bounty: null });
    render(<BountyStatus bountyId="1" />);
    expect(screen.getByText("Failed to load status")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("calls refetch when retry is clicked", () => {
    mockUseBountyStatus.mockReturnValue({ ...defaultMock, error: new Error("fail"), bounty: null });
    render(<BountyStatus bountyId="1" />);
    fireEvent.click(screen.getByText("Retry"));
    expect(defaultMock.refetch).toHaveBeenCalled();
  });

  it("shows 'Bounty not found' when bounty is null and not loading", () => {
    mockUseBountyStatus.mockReturnValue({ ...defaultMock, bounty: null });
    render(<BountyStatus bountyId="1" />);
    expect(screen.getByText("Bounty not found")).toBeInTheDocument();
  });

  it("displays the Live indicator when isLive is true", () => {
    render(<BountyStatus bountyId="1" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("displays the Polling indicator when isPolling is true", () => {
    mockUseBountyStatus.mockReturnValue({ ...defaultMock, isLive: false, isPolling: true });
    render(<BountyStatus bountyId="1" />);
    expect(screen.getByText("Polling")).toBeInTheDocument();
  });

  it("displays the Mock Data badge when source is mock", () => {
    mockUseBountyStatus.mockReturnValue({ ...defaultMock, source: "mock" });
    render(<BountyStatus bountyId="1" />);
    expect(screen.getByText("Mock Data")).toBeInTheDocument();
  });

  it("shows claimed-by when bounty.claimedBy is set", () => {
    mockUseBountyStatus.mockReturnValue({ ...defaultMock, bounty: { id: "1", status: "claimed", claimedBy: "alice" } });
    render(<BountyStatus bountyId="1" />);
    expect(screen.getByText("Claimed by:")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("renders each status with its correct label", () => {
    const statuses = ["open", "funded", "claimed", "in_review", "merged", "paid", "refunded", "expired"] as const;
    const labels = ["Open", "Funded", "Claimed", "In Review", "Merged", "Paid", "Refunded", "Expired"];

    statuses.forEach((status, i) => {
      mockUseBountyStatus.mockReturnValue({ ...defaultMock, status, bounty: { id: "1", status, claimedBy: null } });
      const { unmount } = render(<BountyStatus bountyId="1" />);
      expect(screen.getByText(labels[i])).toBeInTheDocument();
      unmount();
    });
  });
});
