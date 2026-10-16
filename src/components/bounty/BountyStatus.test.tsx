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
jest.mock("@/hooks/useBountyStatus", () => ({
  useBountyStatus: jest.fn(),
}));

const mockUseBountyStatus = useBountyStatus as jest.MockedFunction<typeof useBountyStatus>;
type HookResult = ReturnType<typeof useBountyStatus>;

const refetch = jest.fn();

function mockHook(overrides: Partial<Record<keyof HookResult, unknown>> = {}) {
  mockUseBountyStatus.mockReturnValue({
    bounty: { id: "b1", status: "open" },
    isLoading: false,
    error: null,
    isPolling: false,
    isLive: false,
    status: "open",
    source: "api",
    refetch,
    ...overrides,
  } as unknown as HookResult);
}

describe("BountyStatus", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders a loading skeleton while loading with no bounty yet", () => {
    mockHook({ isLoading: true, bounty: null });
    const { container } = render(<BountyStatus bountyId="b1" />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("Open")).not.toBeInTheDocument();
  });

  it("keeps showing the bounty during a background reload", () => {
    mockHook({ isLoading: true });
    render(<BountyStatus bountyId="b1" />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders the error state with a Retry button that calls refetch", () => {
    mockHook({ error: new Error("boom") });
    render(<BountyStatus bountyId="b1" />);
    expect(screen.getByText("Failed to load status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders 'Bounty not found' when there is no bounty", () => {
    mockHook({ bounty: null });
    render(<BountyStatus bountyId="b1" />);
    expect(screen.getByText("Bounty not found")).toBeInTheDocument();
  });

  it.each([
    ["open", "Open", "text-green-600"],
    ["in_review", "In Review", "text-yellow-600"],
    ["paid", "Paid", "text-purple-600"],
    ["expired", "Expired", "text-red-600"],
  ])("renders the %s status label and colour", (status, label, colour) => {
    mockHook({ status, bounty: { id: "b1", status } });
    render(<BountyStatus bountyId="b1" />);
    expect(screen.getByText(label)).toHaveClass(colour);
  });

  it("falls back to 'Unknown' when status is missing", () => {
    mockHook({ status: undefined });
    render(<BountyStatus bountyId="b1" />);
    expect(screen.getByText("Unknown")).toHaveClass("text-gray-600");
  });

  it.each([
    [{ isLive: true, isPolling: true }, "Live", "bg-green-500"],
    [{ isLive: false, isPolling: true }, "Polling", "bg-yellow-500"],
    [{ isLive: false, isPolling: false }, "Paused", "bg-gray-400"],
  ])("derives the status dot from isLive/isPolling (%o)", (flags, text, dot) => {
    mockHook(flags);
    render(<BountyStatus bountyId="b1" />);
    const indicator = screen.getByText(text);
    expect(indicator.querySelector("span")).toHaveClass(dot);
  });

  it("shows the Mock Data badge only for mock sources", () => {
    mockHook({ source: "mock" });
    const { rerender } = render(<BountyStatus bountyId="b1" />);
    expect(screen.getByText("Mock Data")).toBeInTheDocument();
    mockHook({ source: "api" });
    rerender(<BountyStatus bountyId="b1" />);
    expect(screen.queryByText("Mock Data")).not.toBeInTheDocument();
  });

  it("shows the claimant when the bounty has been claimed", () => {
    mockHook({ status: "claimed", bounty: { id: "b1", status: "claimed", claimedBy: "alice" } });
    render(<BountyStatus bountyId="b1" />);
    expect(screen.getByText("alice")).toBeInTheDocument();
  });
});
