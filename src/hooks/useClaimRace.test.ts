import * as React from "react";
import { act, renderHook } from "@testing-library/react";
import { useClaimRace } from "./useClaimRace";
import { apiPost, fetchBounty } from "@/lib/api";
import type { Bounty } from "@/types/bounty";

// Pass-through useState so tests can observe setter calls (see trackSetStateCalls).
jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return { ...actual, useState: jest.fn(actual.useState) };
});
const realUseState: typeof React.useState = jest.requireActual("react").useState;
const mockUseState = React.useState as unknown as jest.Mock;

jest.mock("@/lib/api", () => ({
  apiPost: jest.fn(),
  fetchBounty: jest.fn(),
}));

const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockFetchBounty = fetchBounty as jest.MockedFunction<typeof fetchBounty>;

const bounty = { id: "b1", status: "claimed" } as Bounty;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Wrap React.useState so every setter call is recorded along with whether the
 * hook was still mounted at the time — React 18+ no longer warns about
 * updates on unmounted components, so this is the observable signal.
 */
function trackSetStateCalls() {
  const calls: { mounted: boolean }[] = [];
  const state = { mounted: true };
  mockUseState.mockImplementation(((initial: unknown) => {
    const [value, setValue] = realUseState(initial);
    const tracked = (next: unknown) => {
      calls.push({ mounted: state.mounted });
      setValue(next);
    };
    return [value, tracked];
  }) as typeof React.useState);
  return { calls, state };
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => mockUseState.mockImplementation(realUseState));

describe("useClaimRace (mounted)", () => {
  it("records a successful claim and calls onClaimSuccess", async () => {
    mockApiPost.mockResolvedValueOnce({ data: bounty });
    const onClaimSuccess = jest.fn();
    const { result } = renderHook(() => useClaimRace("b1", onClaimSuccess));

    let returned;
    await act(async () => {
      returned = await result.current.claim();
    });

    expect(returned).toEqual({ success: true, bounty });
    expect(result.current.lastResult).toEqual({ success: true, bounty });
    expect(result.current.isClaiming).toBe(false);
    expect(onClaimSuccess).toHaveBeenCalledWith(bounty);
  });

  it("maps a 409 to ALREADY_CLAIMED with the refreshed bounty", async () => {
    mockApiPost.mockRejectedValueOnce({ status: 409, message: "conflict" });
    mockFetchBounty.mockResolvedValueOnce({ data: bounty } as never);
    const { result } = renderHook(() => useClaimRace("b1"));

    await act(async () => {
      await result.current.claim();
    });

    expect(result.current.lastResult).toEqual({
      success: false,
      error: "ALREADY_CLAIMED",
      bounty,
    });
  });

  it("maps other failures to NETWORK_ERROR", async () => {
    mockApiPost.mockRejectedValueOnce(new Error("socket hang up"));
    const { result } = renderHook(() => useClaimRace("b1"));

    await act(async () => {
      await result.current.claim();
    });

    expect(result.current.lastResult).toEqual({
      success: false,
      error: "NETWORK_ERROR",
      message: "socket hang up",
    });
    expect(result.current.isClaiming).toBe(false);
  });
});

describe("useClaimRace — unmount while a claim is in flight (#361)", () => {
  it("success: no state updates or onClaimSuccess after unmount, but claim() still resolves", async () => {
    const { calls, state } = trackSetStateCalls();
    const pending = deferred<{ data: Bounty }>();
    mockApiPost.mockReturnValueOnce(pending.promise);
    const onClaimSuccess = jest.fn();
    const { result, unmount } = renderHook(() => useClaimRace("b1", onClaimSuccess));

    let claimPromise!: Promise<unknown>;
    act(() => {
      claimPromise = result.current.claim();
    });
    unmount();
    state.mounted = false;

    pending.resolve({ data: bounty });
    await expect(claimPromise).resolves.toEqual({ success: true, bounty });

    expect(calls.filter((c) => !c.mounted)).toHaveLength(0);
    expect(onClaimSuccess).not.toHaveBeenCalled();
  });

  it("409 path: no state updates after unmount during the fetchBounty follow-up", async () => {
    const { calls, state } = trackSetStateCalls();
    mockApiPost.mockRejectedValueOnce({ status: 409 });
    const pendingFetch = deferred<{ data: Bounty }>();
    mockFetchBounty.mockReturnValueOnce(pendingFetch.promise as never);
    const { result, unmount } = renderHook(() => useClaimRace("b1"));

    let claimPromise!: Promise<unknown>;
    act(() => {
      claimPromise = result.current.claim();
    });
    // Let the rejected apiPost settle so the hook is now awaiting fetchBounty.
    await Promise.resolve();
    await Promise.resolve();
    unmount();
    state.mounted = false;

    pendingFetch.resolve({ data: bounty });
    await expect(claimPromise).resolves.toMatchObject({ error: "ALREADY_CLAIMED" });
    expect(calls.filter((c) => !c.mounted)).toHaveLength(0);
  });

  it("error path: no state updates after unmount when apiPost rejects", async () => {
    const { calls, state } = trackSetStateCalls();
    const pending = deferred<{ data: Bounty }>();
    mockApiPost.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => useClaimRace("b1"));

    let claimPromise!: Promise<unknown>;
    act(() => {
      claimPromise = result.current.claim();
    });
    unmount();
    state.mounted = false;

    pending.reject(new Error("offline"));
    await expect(claimPromise).resolves.toMatchObject({ error: "NETWORK_ERROR" });
    expect(calls.filter((c) => !c.mounted)).toHaveLength(0);
  });

  it("still updates state after a Strict Mode simulated remount", async () => {
    mockApiPost.mockResolvedValueOnce({ data: bounty });
    const { result } = renderHook(() => useClaimRace("b1"), {
      wrapper: React.StrictMode,
    });

    await act(async () => {
      await result.current.claim();
    });

    expect(result.current.lastResult).toEqual({ success: true, bounty });
  });
});
