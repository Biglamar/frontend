/**
 * useSmartPolling.test.tsx (#620)
 *
 * Covers start, backoff, the enabled toggle, and unmount — the exact
 * scenarios behind open bugs #568 (polling stops after first re-render),
 * #569 (backoff never applies), and #570 (re-enable never restarts).
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useSmartPolling } from "./useSmartPolling";

function createFetchFn(values: unknown[], callCountRef: { count: number }) {
  return jest.fn(async () => {
    const val = values[Math.min(callCountRef.count, values.length - 1)];
    callCountRef.count += 1;
    return val;
  });
}

describe("useSmartPolling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fetches on mount and sets data", async () => {
    const ref = { count: 0 };
    const fetchFn = createFetchFn([{ n: 1 }], ref);
    const { result } = renderHook(() =>
      useSmartPolling({ fetchFn, interval: 1000 }),
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ n: 1 });
  });

  it("polls on the interval", async () => {
    const ref = { count: 0 };
    const fetchFn = createFetchFn([{ n: 1 }, { n: 2 }, { n: 3 }], ref);
    renderHook(() => useSmartPolling({ fetchFn, interval: 1000 }));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
  });

  it("keeps polling across re-renders when callbacks are inline (#568)", async () => {
    const ref = { count: 0 };
    const base = createFetchFn([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }], ref);
    renderHook(() =>
      useSmartPolling({
        fetchFn: () => base(),
        compareFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
        onDataChange: () => {},
        interval: 1000,
      }),
    );

    await waitFor(() => expect(base).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    await waitFor(() => expect(base.mock.calls.length).toBeGreaterThan(2));
  });

  it("applies backoff after unchangedThreshold identical results", async () => {
    const ref = { count: 0 };
    // Always return the same value → compareFn says "unchanged"
    const fetchFn = createFetchFn([{ n: 1 }], ref);
    const { result } = renderHook(() =>
      useSmartPolling({
        fetchFn,
        interval: 1000,
        unchangedThreshold: 2,
        backoffMultiplier: 2,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Advance to trigger more polls with identical data
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    // After 3 polls with identical data (unchangedThreshold=2), backoff should engage
    expect(result.current.isBackingOff).toBe(true);
  });

  it("does not poll when enabled is false", async () => {
    const ref = { count: 0 };
    const fetchFn = createFetchFn([{ n: 1 }], ref);
    renderHook(() => useSmartPolling({ fetchFn, interval: 1000, enabled: false }));

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("re-enables and restarts polling when enabled flips back to true", async () => {
    const ref = { count: 0 };
    const fetchFn = createFetchFn([{ n: 1 }, { n: 2 }], ref);
    const { rerender } = renderHook(
      ({ enabled }) => useSmartPolling({ fetchFn, interval: 1000, enabled }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    // Disable
    rerender({ enabled: false });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Re-enable — should restart polling
    rerender({ enabled: true });
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
  });

  it("calls onDataChange when data changes", async () => {
    const ref = { count: 0 };
    const fetchFn = createFetchFn([{ n: 1 }, { n: 2 }], ref);
    const onDataChange = jest.fn();
    renderHook(() =>
      useSmartPolling({ fetchFn, interval: 1000, onDataChange }),
    );

    await waitFor(() => expect(onDataChange).toHaveBeenCalledWith({ n: 1 }));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(onDataChange).toHaveBeenCalledWith({ n: 2 }));
  });

  it("sets error when fetch fails", async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error("fetch failed");
    });
    const { result } = renderHook(() =>
      useSmartPolling({ fetchFn, interval: 1000 }),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe("fetch failed");
  });

  it("cleans up on unmount", async () => {
    const ref = { count: 0 };
    const fetchFn = createFetchFn([{ n: 1 }], ref);
    const { unmount } = renderHook(() =>
      useSmartPolling({ fetchFn, interval: 1000 }),
    );

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    // No additional calls after unmount
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
