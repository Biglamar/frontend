/**
 * useBountyStatus.test.tsx (#620)
 *
 * Covers the hook wrapping useSmartPolling: returns bounty data, status,
 * source, and isLive flag. Mocks fetchBounty.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useBountyStatus } from "./useBountyStatus";

jest.mock("@/lib/api", () => ({
  fetchBounty: jest.fn(),
}));

const { fetchBounty } = jest.requireMock("@/lib/api");

const mockBounty = {
  id: "b1",
  title: "Fix bug",
  status: "open" as const,
  claimedBy: null,
  reward: 100,
  asset: "USDC" as const,
};

describe("useBountyStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches and returns bounty data", async () => {
    fetchBounty.mockResolvedValue({ data: mockBounty, source: "live" });

    const { result } = renderHook(() =>
      useBountyStatus({ bountyId: "b1", enabled: false }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bounty).toEqual(mockBounty);
    expect(result.current.status).toBe("open");
    expect(result.current.source).toBe("live");
  });

  it("returns null bounty when fetch returns undefined data", async () => {
    fetchBounty.mockResolvedValue({ data: undefined, source: "mock" });

    const { result } = renderHook(() =>
      useBountyStatus({ bountyId: "b1", enabled: false }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bounty).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.source).toBe("mock");
  });

  it("calls onStatusChange when status changes", async () => {
    const onStatusChange = jest.fn();
    fetchBounty.mockResolvedValue({ data: mockBounty, source: "live" });

    renderHook(() =>
      useBountyStatus({
        bountyId: "b1",
        enabled: true,
        interval: 100,
        onStatusChange,
      }),
    );

    await waitFor(() =>
      expect(onStatusChange).toHaveBeenCalledWith("open"),
    );
  });

  it("reports isLive when polling and not backing off", async () => {
    fetchBounty.mockResolvedValue({ data: mockBounty, source: "live" });

    const { result } = renderHook(() =>
      useBountyStatus({ bountyId: "b1", enabled: true, interval: 1000 }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPolling).toBe(true);
    expect(result.current.isLive).toBe(true);
  });
});
