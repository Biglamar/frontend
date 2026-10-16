import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { TOKEN_KEY } from "@/lib/auth";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AuthUser } from "@/types";

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

const PROFILE: AuthUser = {
  id: "user-1",
  username: "alice",
  displayName: "Alice",
  avatarUrl: null,
  roles: [],
  stellarAddress: null,
};

function TestConsumer() {
  const { user, loading, login, logout, degraded } = useAuth();
  return (
    <div>
      <div data-testid="state">
        {loading ? "loading" : user ? `signed-in:${user.username}` : "signed-out"}
      </div>
      <div data-testid="degraded">{String(degraded)}</div>
      {/* Independent of `loading`, so a resolved user stays observable while a
          second overlapping resolve is still pending. */}
      <div data-testid="user">{user ? user.username : "none"}</div>
      <button onClick={() => void login("new-token")}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function dispatchTokenStorageEvent(newValue: string | null) {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: TOKEN_KEY,
      newValue,
      storageArea: window.localStorage,
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  mockApiRequest.mockReset();
});

describe("AuthContext — cross-tab sync (issue #84)", () => {
  it("signs the user out when another tab clears the token", async () => {
    window.localStorage.setItem(TOKEN_KEY, "token-a");
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/auth/me") return { userId: "user-1", username: "alice" };
      return PROFILE;
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );

    act(() => {
      dispatchTokenStorageEvent(null);
    });

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-out"),
    );
  });

  it("re-resolves the session when another tab sets a new token", async () => {
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/auth/me") return { userId: "user-1", username: "alice" };
      return PROFILE;
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-out"),
    );

    act(() => {
      // A real browser's storage event fires only in other tabs, after that
      // tab's own localStorage.setItem() has already applied to the shared,
      // same-origin backing store — so the write is reflected here too.
      window.localStorage.setItem(TOKEN_KEY, "token-from-other-tab");
      dispatchTokenStorageEvent("token-from-other-tab");
    });

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );
    expect(mockApiRequest).toHaveBeenCalledWith("/auth/me");
  });

  it("ignores storage events for unrelated keys", async () => {
    window.localStorage.setItem(TOKEN_KEY, "token-a");
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/auth/me") return { userId: "user-1", username: "alice" };
      return PROFILE;
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );
    const callCountBefore = mockApiRequest.mock.calls.length;

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "mergefi_wallet_address",
          newValue: "GABC...",
          storageArea: window.localStorage,
        }),
      );
    });

    expect(mockApiRequest.mock.calls.length).toBe(callCountBefore);
    expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice");
  });
});

describe("AuthContext — session hydration (#232)", () => {
  it("refresh(): resolves /auth/me then /users/:id and sets user when a token is stored", async () => {
    window.localStorage.setItem(TOKEN_KEY, "token-a");
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/auth/me") return { userId: "user-1", username: "alice" };
      expect(path).toBe("/users/user-1");
      return PROFILE;
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );
  });

  it("refresh(): sets user to null and skips the network entirely when no token is stored", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-out"),
    );
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("refresh(): clears the token and signs out when /auth/me returns 401", async () => {
    window.localStorage.setItem(TOKEN_KEY, "stale-token");
    mockApiRequest.mockRejectedValue(new ApiRequestError("Unauthorized", 401));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-out"),
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("refresh(): retries on network errors and keeps the token", async () => {
    jest.useFakeTimers();
    window.localStorage.setItem(TOKEN_KEY, "valid-token");
    const successImpl = async (path: string) => {
      if (path === "/auth/me") return { userId: "user-1", username: "alice" };
      return PROFILE;
    };
    mockApiRequest
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(successImpl);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Advance past the deferred mount setTimeout(, 0)
    await act(async () => { jest.advanceTimersByTime(10); });
    // Advance past first retry backoff (200ms)
    await act(async () => { jest.advanceTimersByTime(300); });
    // Advance past second retry backoff (400ms)
    await act(async () => { jest.advanceTimersByTime(500); });

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("valid-token");
    jest.useRealTimers();
  });

  it("refresh(): keeps the session after all retries are exhausted", async () => {
    jest.useFakeTimers();
    window.localStorage.setItem(TOKEN_KEY, "valid-token");
    mockApiRequest.mockRejectedValue(new TypeError("Failed to fetch"));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Advance past mount + 3 retries with backoff delays
    await act(async () => { jest.advanceTimersByTime(10); });
    await act(async () => { jest.advanceTimersByTime(300); });
    await act(async () => { jest.advanceTimersByTime(500); });
    await act(async () => { jest.advanceTimersByTime(1000); });

    expect(mockApiRequest).toHaveBeenCalledTimes(3);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("valid-token");
    jest.useRealTimers();
  });

  it("login(): persists the token and resolves the session", async () => {
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/auth/me") return { userId: "user-1", username: "alice" };
      return PROFILE;
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-out"),
    );

    fireEvent.click(screen.getByText("login"));

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("new-token");
  });

  it("logout(): clears the token and signs the user out", async () => {
    window.localStorage.setItem(TOKEN_KEY, "token-a");
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/auth/me") return { userId: "user-1", username: "alice" };
      return PROFILE;
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );

    fireEvent.click(screen.getByText("logout"));

    expect(screen.getByTestId("state")).toHaveTextContent("signed-out");
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("AuthContext — loading stays true across a sign-in (#456)", () => {
  // The flash this guards: `refresh()` never set `loading` back to true, only
  // ever drove it true -> false. So for the whole duration of the GitHub OAuth
  // token exchange the Navbar rendered its *signed-out* CTAs, including a live
  // "Connect GitHub" button that would re-enter the very OAuth flow the user
  // had just completed.
  it("reports loading during login() rather than settling to signed-out", async () => {
    let releaseMe: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseMe = resolve;
    });
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/auth/me") {
        await gate;
        return { userId: "user-1", username: "alice" };
      }
      return PROFILE;
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Mount hydration finds no token and settles.
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-out"),
    );

    fireEvent.click(screen.getByText("login"));

    // Mid-exchange: still pending, NOT a settled signed-out state.
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("loading"));
    expect(screen.getByTestId("state")).not.toHaveTextContent("signed-out");

    releaseMe?.();
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );
  });

  it("does not clear loading while a second overlapping resolve is still in flight", async () => {
    // Mount hydration and a cross-tab re-resolve can overlap. Whichever
    // settles first must not report "resolved" while the other is still
    // pending, or the UI commits to a chrome it has to correct a frame later.
    let releaseMe: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseMe = resolve;
    });
    let meCalls = 0;
    mockApiRequest.mockImplementation(async (path: string) => {
      if (path === "/auth/me") {
        meCalls += 1;
        if (meCalls === 1) await gate;
        return { userId: "user-1", username: "alice" };
      }
      return PROFILE;
    });
    // A stored token is required, or the mount refresh returns before ever
    // calling the network and there is no first resolve to overlap with.
    window.localStorage.setItem(TOKEN_KEY, "first-token");

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // The mount resolve is now parked inside the gated /auth/me call.
    await waitFor(() => expect(meCalls).toBe(1));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: TOKEN_KEY,
          newValue: "second-token",
          storageArea: window.localStorage,
        }),
      );
    });

    await waitFor(() => expect(meCalls).toBe(2));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("alice"));
    // The first resolve is still outstanding, so `loading` must still be true
    // even though a user is already resolved — the UI shows a neutral pending
    // state rather than committing to chrome it would have to correct.
    expect(screen.getByTestId("state")).toHaveTextContent("loading");

    releaseMe?.();
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );
    expect(screen.getByTestId("state")).not.toHaveTextContent("loading");
  });
});

describe("AuthContext — degraded session (#456)", () => {
  // `user === null` means "signed out" to every consumer. When the token is
  // valid but the backend was unreachable, that reading is wrong: the
  // dashboards' `if (!user)` branch renders mock data, so a transient outage
  // would present fabricated numbers as the user's own.
  it("marks the session degraded when retries are exhausted, keeping the token", async () => {
    mockApiRequest.mockRejectedValue(new Error("network down"));
    window.localStorage.setItem(TOKEN_KEY, "stored-token");

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("degraded")).toHaveTextContent("true"));
    // Signed out, not signed in — but explicitly flagged as "could not tell".
    expect(screen.getByTestId("state")).toHaveTextContent("signed-out");
    // The token survives: a network failure is not an invalid session.
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("stored-token");
  });

  it("does not mark a normal signed-out session as degraded", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-out"));
    expect(screen.getByTestId("degraded")).toHaveTextContent("false");
  });

  it("clears the degraded flag once a resolve succeeds", async () => {
    mockApiRequest.mockRejectedValueOnce(new Error("network down"));
    window.localStorage.setItem(TOKEN_KEY, "stored-token");

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("degraded")).toHaveTextContent("true"));

    mockApiRequest.mockImplementation(async (path: string) =>
      path === "/auth/me" ? { userId: "user-1", username: "alice" } : PROFILE,
    );
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: TOKEN_KEY,
          newValue: "stored-token",
          storageArea: window.localStorage,
        }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in:alice"),
    );
    expect(screen.getByTestId("degraded")).toHaveTextContent("false");
  });
});
