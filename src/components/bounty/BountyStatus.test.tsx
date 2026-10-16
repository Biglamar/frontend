import { render, screen, fireEvent } from "@testing-library/react";
import { BountyStatus } from "./BountyStatus";
import { useBountyStatus } from "@/hooks/useBountyStatus";

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
