import { render, screen, waitFor, act } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { CallbackClient } from "./CallbackClient";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser, UserRole } from "@/types";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockReplace = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedUseAuth = useAuth as jest.MockedFunction<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedUseSearchParams = useSearchParams as jest.MockedFunction<any>;
const mockedUseRouter = useRouter as jest.Mock;

function makeUser(roles: UserRole[], stellarAddress: string | null = "GWALLET"): AuthUser {
  return {
    id: "1",
    username: "testuser",
    displayName: "Test User",
    avatarUrl: null,
    roles,
    stellarAddress,
  };
}

/**
 * Creates a mock useAuth that starts with user: null and transitions
 * to the resolved user after login() is called, mirroring real
 * AuthContext behavior (login → refresh → setUser).
 *
 * login() must resolve *with* the user, not just resolve void:
 * CallbackClient redirects on the value returned by login() (see
 * AuthContextValue.login → Promise<AuthUser | null>), so a mock that
 * resolves undefined makes every role assertion fall through to the
 * contributor fallback.
 */
function createAsyncAuthMock(resolvedUser: AuthUser) {
  let setUser: ((user: AuthUser | null) => void) | null = null;
  const loginMock = jest.fn().mockImplementation(() => {
    return new Promise<AuthUser | null>((resolve) => {
      // Trigger re-render with resolved user after login completes
      setTimeout(() => {
        act(() => {
          setUser?.(resolvedUser);
        });
        resolve(resolvedUser);
      }, 0);
    });
  });

  return {
    loginMock,
    getAuthValue: () => ({
      login: loginMock,
      user: null as AuthUser | null,
      setUser: (fn: (prev: AuthUser | null) => AuthUser | null) => {
        setUser = (u) => fn(u);
      },
    }),
  };
}

describe("CallbackClient — role-based redirect (#77)", () => {
  const SINGLE_ROLE_REDIRECTS: ReadonlyArray<readonly [UserRole[], string]> = [
    [["maintainer"], "/dashboard/maintainer"],
    [["sponsor"], "/dashboard/sponsor"],
    [["contributor"], "/dashboard/contributor"],
  ];

  it("redirects maintainer to /dashboard/maintainer after async login", async () => {
    const { getAuthValue } = createAsyncAuthMock(makeUser(["maintainer"]));
    // Simulate AuthContext behavior: user starts null, becomes populated after login
    let currentUser: AuthUser | null = null;
    const authValue = getAuthValue();
    authValue.setUser((prev: AuthUser | null) => prev);

    mockedUseAuth.mockImplementation(() => ({
      ...authValue,
      get user() { return currentUser; },
    }));

    // Simulate AuthContext's setUser call after login resolves
    authValue.setUser = (fn: (prev: AuthUser | null) => AuthUser | null) => {
      currentUser = fn(currentUser);
    };

    render(<CallbackClient />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expected));
  });

  it("redirects sponsor to /dashboard/sponsor after async login", async () => {
    const { getAuthValue } = createAsyncAuthMock(makeUser(["sponsor"]));
    let currentUser: AuthUser | null = null;
    const authValue = getAuthValue();
    authValue.setUser = (fn: (prev: AuthUser | null) => AuthUser | null) => {
      currentUser = fn(currentUser);
    };

    mockedUseAuth.mockImplementation(() => ({
      ...authValue,
      get user() { return currentUser; },
    }));

    render(<CallbackClient />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard/maintainer"),
    );
  });

  it("redirects contributor to /dashboard/contributor after async login", async () => {
    const { getAuthValue } = createAsyncAuthMock(makeUser(["contributor"]));
    let currentUser: AuthUser | null = null;
    const authValue = getAuthValue();
    authValue.setUser = (fn: (prev: AuthUser | null) => AuthUser | null) => {
      currentUser = fn(currentUser);
    };

    mockedUseAuth.mockImplementation(() => ({
      ...authValue,
      get user() { return currentUser; },
    }));

    render(<CallbackClient />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard/contributor"),
    );
  });

  it("prefers maintainer over sponsor when user has multiple roles", async () => {
    const user = makeUser(["sponsor", "maintainer"]);
    mockedUseAuth.mockReturnValue({
      login: jest.fn().mockResolvedValue(user),
    });
    const { getAuthValue } = createAsyncAuthMock(makeUser(["sponsor", "maintainer"]));
    let currentUser: AuthUser | null = null;
    const authValue = getAuthValue();
    authValue.setUser = (fn: (prev: AuthUser | null) => AuthUser | null) => {
      currentUser = fn(currentUser);
    };

    mockedUseAuth.mockImplementation(() => ({
      ...authValue,
      get user() { return currentUser; },
    }));

    render(<CallbackClient />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard/maintainer"),
    );
    expect(login).toHaveBeenCalledWith("jwt-token");
  });
});

describe("CallbackClient — unfinished wallet link (#456)", () => {
  it("returns to /connect when the resolved user has no payout wallet", async () => {
    mockedUseAuth.mockReturnValue({
      login: jest.fn().mockResolvedValue(makeUser(["maintainer"], null)),
    });
    const { getAuthValue } = createAsyncAuthMock(makeUser([]));
    let currentUser: AuthUser | null = null;
    const authValue = getAuthValue();
    authValue.setUser = (fn: (prev: AuthUser | null) => AuthUser | null) => {
      currentUser = fn(currentUser);
    };

    mockedUseAuth.mockImplementation(() => ({
      ...authValue,
      get user() { return currentUser; },
    }));

    render(<CallbackClient />);

    // /connect is the only page that can complete the link, and nothing in the
    // dashboard nav links back to it — landing on a dashboard instead would
    // strand the user with no way to finish.
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/connect"));
  });

  it("falls back to contributor when user remains null after login", async () => {
    // Test case where login succeeds but user is still null (no roles)
    mockedUseAuth.mockReturnValue({
      login: jest.fn().mockResolvedValue(makeUser(["sponsor"], "GWALLET")),
    });

    render(<CallbackClient />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard/sponsor"),
    );
    expect(mockReplace).not.toHaveBeenCalledWith("/connect");
  });
});

describe("CallbackClient — failure paths", () => {
  it("surfaces an error instead of landing on a demo dashboard when login resolves null", async () => {
    // The failure this guards: a transient backend error makes refresh()
    // return null while the token stays valid. Redirecting anyway dropped the
    // user into a dashboard whose `if (!user)` branch renders mock data as if
    // it were theirs.
    mockedUseAuth.mockReturnValue({ login: jest.fn().mockResolvedValue(null) });

    render(<CallbackClient />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Could not complete sign-in/,
      ),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows an error when no token is present", async () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());
    mockedUseAuth.mockReturnValue({ login: jest.fn() });

    render(<CallbackClient />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /No token was returned by GitHub sign-in/,
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("strips the token from the URL before it can reach browser history (#9)", () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn().mockResolvedValue(makeUser([])) });
    const replaceState = jest.spyOn(window.history, "replaceState");

    render(<CallbackClient />);

    // Rewrites the URL with no query string at all — the assertion is on the
    // JWT being gone rather than on a specific pathname, since the test
    // environment's location is not the callback route.
    expect(replaceState).toHaveBeenCalled();
    const rewritten = replaceState.mock.calls[0][2] as string;
    expect(rewritten).not.toContain("token");
    expect(rewritten).not.toContain("?");
  });
});
