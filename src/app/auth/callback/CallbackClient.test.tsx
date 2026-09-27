/**
 * CallbackClient.test.tsx (#77, #456)
 *
 * Covers the post-sign-in redirect matrix:
 *   - single role       → that role's dashboard
 *   - multiple roles    → highest-precedence dashboard on *arrival only*; the
 *                        Navbar is what exposes every role afterwards
 *   - no roles          → contributor dashboard (demo mode)
 *   - login() → null    → visible error, never a silent demo-dashboard landing
 *   - no wallet linked  → /connect, so the unfinished setup step is reachable
 *   - missing token     → visible error
 */

import { render, screen, waitFor } from "@testing-library/react";
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

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseRouter.mockReturnValue({ replace: mockReplace });
  mockedUseSearchParams.mockReturnValue(new URLSearchParams({ token: "jwt-token" }));
});

describe("CallbackClient — role-based redirect (#77)", () => {
  const SINGLE_ROLE_REDIRECTS: ReadonlyArray<readonly [UserRole[], string]> = [
    [["maintainer"], "/dashboard/maintainer"],
    [["sponsor"], "/dashboard/sponsor"],
    [["contributor"], "/dashboard/contributor"],
  ];

  it.each(SINGLE_ROLE_REDIRECTS)("redirects %s to %s", async (roles, expected) => {
    mockedUseAuth.mockReturnValue({ login: jest.fn().mockResolvedValue(makeUser(roles)) });

    render(<CallbackClient />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expected));
  });

  it("prefers maintainer over sponsor when the account holds both roles", async () => {
    mockedUseAuth.mockReturnValue({
      login: jest.fn().mockResolvedValue(makeUser(["sponsor", "maintainer"])),
    });

    render(<CallbackClient />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard/maintainer"),
    );
  });

  it("falls back to the contributor dashboard when the account has no roles", async () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn().mockResolvedValue(makeUser([])) });

    render(<CallbackClient />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard/contributor"),
    );
  });

  it("uses the user returned by login, not a stale context value", async () => {
    const login = jest.fn().mockResolvedValue(makeUser(["maintainer"]));
    // A stale context value that would send the user to the wrong dashboard
    // if the component read `user` instead of login()'s return value.
    mockedUseAuth.mockReturnValue({ login, user: makeUser(["sponsor"]) });

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

    render(<CallbackClient />);

    // /connect is the only page that can complete the link, and nothing in the
    // dashboard nav links back to it — landing on a dashboard instead would
    // strand the user with no way to finish.
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/connect"));
  });

  it("goes straight to the dashboard when a payout wallet is already linked", async () => {
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
