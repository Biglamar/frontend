/**
 * ContributorDashboardClient — effect races and data-source honesty.
 *
 * This page runs two independent fetches (reputation stats + the bounty
 * list) that feed one shared badge and two different regions. These tests
 * pin down the two things that were wrong with that:
 *
 *  1. Out-of-order resolution — an earlier, slower stats request could land
 *     after a later one and overwrite fresher numbers with stale ones.
 *  2. An unqualified "Live data" badge while the bounty lists underneath it
 *     were silently the bundled mock rows.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import ContributorDashboardClient from "./ContributorDashboardClient";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, fetchBounties, type FetchResult } from "@/lib/api";
import { mockBounties } from "@/lib/mock-data";
import type { Bounty } from "@/types";

jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  apiRequest: jest.fn(),
  fetchBounties: jest.fn(),
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => "/dashboard/contributor",
  useSearchParams: () => new URLSearchParams(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockFetchBounties = fetchBounties as jest.MockedFunction<typeof fetchBounties>;

interface Snapshot {
  totalEarnings: string;
  mergedPrCount: number;
  completionRate: string;
}

const SNAPSHOT: Snapshot = {
  totalEarnings: "1200",
  mergedPrCount: 7,
  completionRate: "90",
};

function setUser(user: { id: string; username: string } | null) {
  mockUseAuth.mockReturnValue({
    user,
    loading: false,
  } as unknown as ReturnType<typeof useAuth>);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchBounties.mockResolvedValue({
    data: mockBounties,
    source: "live",
  } as FetchResult<Bounty[]>);
});

describe("ContributorDashboardClient — data-source badge", () => {
  it('claims "Live data" when both independent fetches reach the backend', async () => {
    mockApiRequest.mockResolvedValue(SNAPSHOT);
    setUser({ id: "u1", username: "alice" });

    render(<ContributorDashboardClient />);

    expect(await screen.findByText("Live data")).toBeInTheDocument();
    expect(screen.queryByText("Mixed data")).not.toBeInTheDocument();
    expect(screen.queryByText("Demo data")).not.toBeInTheDocument();
  });

  it('never claims page-wide "Live data" while the bounty list is the mock fallback', async () => {
    mockApiRequest.mockResolvedValue(SNAPSHOT);
    mockFetchBounties.mockResolvedValue({
      data: mockBounties,
      source: "mock",
    } as FetchResult<Bounty[]>);
    setUser({ id: "u1", username: "alice" });

    render(<ContributorDashboardClient />);

    expect(await screen.findByText("Mixed data")).toBeInTheDocument();
    expect(screen.queryByText("Live data")).not.toBeInTheDocument();

    // And the fallback is called out where it is actually rendered — both
    // bounty sections — not just implied by the page-level badge.
    expect(screen.getAllByText("Sample data")).toHaveLength(2);
    expect(screen.getByText("Your claims")).toBeInTheDocument();
    expect(screen.getByText("Open bounties")).toBeInTheDocument();
  });

  it('shows "Demo data" for a signed-out reader and never calls the API', async () => {
    setUser(null);

    render(<ContributorDashboardClient />);

    expect(await screen.findByText("Demo data")).toBeInTheDocument();
    expect(screen.queryByText("Live data")).not.toBeInTheDocument();
    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(mockFetchBounties).not.toHaveBeenCalled();
  });
});

describe("ContributorDashboardClient — out-of-order response guard", () => {
  it("keeps the last-started stats request's data when an earlier one resolves later", async () => {
    const first = deferred<Snapshot | null>();
    const second = deferred<Snapshot | null>();
    mockApiRequest
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    setUser({ id: "u1", username: "alice" });
    const { rerender } = render(<ContributorDashboardClient />);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);

    // A different signed-in identity re-runs the effect while #1 is still in
    // flight — the shape an unrelated AuthContext.refresh() used to produce.
    setUser({ id: "u2", username: "bob" });
    rerender(<ContributorDashboardClient />);
    expect(mockApiRequest).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve(SNAPSHOT);
    });
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "@bob",
    );

    // The slower, earlier request lands afterwards. Before the generation
    // guard this overwrote the fresher result with `handle: "alice"`.
    await act(async () => {
      first.resolve({ totalEarnings: "9999", mergedPrCount: 99, completionRate: "10" });
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("@bob");
    });
    expect(screen.queryByText(/@alice/)).not.toBeInTheDocument();
    expect(screen.queryByText(/9999/)).not.toBeInTheDocument();
  });

  it("applies a single successful load exactly once", async () => {
    mockApiRequest.mockResolvedValue(SNAPSHOT);
    setUser({ id: "u1", username: "alice" });

    render(<ContributorDashboardClient />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "@alice",
    );
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockFetchBounties).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Live data")).toBeInTheDocument();
  });
});
