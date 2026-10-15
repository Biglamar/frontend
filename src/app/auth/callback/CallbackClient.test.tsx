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

function mockSearchParams(token: string | null, code: string | null = null) {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (code) params.set("code", code);
  mockedUseSearchParams.mockReturnValue(params);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseRouter.mockReturnValue({ replace: mockReplace });
});

describe("CallbackClient — role-based redirect (#77)", () => {
  const SINGLE_ROLE_REDIRECTS: ReadonlyArray<readonly [UserRole[], string]> = [
    [["maintainer"], "/dashboard/maintainer"],
    [["sponsor"], "/dashboard/sponsor"],
    [["contributor"], "/dashboard/contributor"],
  ];

  it.each(SINGLE_ROLE_REDIRECTS)(
    "redirects %s to %s after async login",
    async (roles, expected) => {
      const user = makeUser([...roles]);
      const loginMock = jest.fn().mockResolvedValue(undefined);

      mockedUseAuth.mockReturnValue({
        login: loginMock,
        user: null,
        loading: false,
        degraded: false,
        logout: jest.fn(),
        refresh: jest.fn(),
      });

      mockSearchParams("valid-token");

      render(<CallbackClient />);

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expected));
    },
  );

  it("strips the token from the URL after successful login (#9)", async () => {
    const loginMock = jest.fn().mockResolvedValue(undefined);

    mockedUseAuth.mockReturnValue({
      login: loginMock,
      user: null,
      loading: false,
      degraded: false,
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    mockSearchParams("valid-token");

    render(<CallbackClient />);

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith("valid-token"));
  });

  it("shows error when no token or code is present", async () => {
    mockedUseAuth.mockReturnValue({
      login: jest.fn(),
      user: null,
      loading: false,
      degraded: false,
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    mockSearchParams(null);

    render(<CallbackClient />);

    await waitFor(() =>
      expect(screen.getByText(/No token was returned/)).toBeInTheDocument(),
    );
  });

  it("handles code-based handoff flow (#591)", async () => {
    const loginMock = jest.fn().mockResolvedValue(undefined);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accessToken: "exchanged-token" }),
    }) as jest.Mock;

    mockedUseAuth.mockReturnValue({
      login: loginMock,
      user: null,
      loading: false,
      degraded: false,
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    mockSearchParams(null, "handoff-code");

    render(<CallbackClient />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "handoff-code" }),
      }),
    );
    await waitFor(() => expect(loginMock).toHaveBeenCalledWith("exchanged-token"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard/contributor"));
  });
});
