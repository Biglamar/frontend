/**
 * ConnectPanel.test.tsx (#233)
 *
 * ConnectPanel is the sole onboarding entry point combining GitHub OAuth
 * state (useAuth) and Freighter wallet state (useWallet) side by side, and
 * the page every signed-out visitor is routed to. Mocks both hooks directly
 * (rather than rendering through the real providers) so each of the four
 * connection-state combinations, plus the wallet's connecting/error states,
 * can be asserted independently.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectPanel } from "./ConnectPanel";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import type { AuthUser } from "@/types";

jest.mock("@/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/context/WalletContext", () => ({
  useWallet: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseWallet = useWallet as jest.Mock;

const USER: AuthUser = {
  id: "user-1",
  username: "devrel_ana",
  displayName: "Ana",
  avatarUrl: null,
  roles: [],
  stellarAddress: null,
};

function setAuth(user: AuthUser | null) {
  mockUseAuth.mockReturnValue({ user });
}

function setWallet(overrides: Partial<ReturnType<typeof useWallet>> = {}) {
  mockUseWallet.mockReturnValue({
    address: null,
    network: null,
    connecting: false,
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseWallet.mockReset();
});

describe("ConnectPanel — GitHub card", () => {
  it("shows the Continue with GitHub link when signed out", () => {
    setAuth(null);
    setWallet();
    render(<ConnectPanel />);

    expect(screen.getByText("Continue with GitHub")).toBeInTheDocument();
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it("shows the signed-in state with the username when signed in", () => {
    setAuth(USER);
    setWallet();
    render(<ConnectPanel />);

    expect(screen.getByText("Signed in as @devrel_ana")).toBeInTheDocument();
    expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();
  });
});

describe("ConnectPanel — wallet card", () => {
  it("shows the Connect Freighter button when no address is set", () => {
    setAuth(null);
    setWallet({ address: null });
    render(<ConnectPanel />);

    expect(screen.getByText("Connect Freighter")).toBeInTheDocument();
    expect(screen.queryByText(/Connected:/)).not.toBeInTheDocument();
  });

  it("shows the connected state with a truncated address and network", () => {
    setAuth(null);
    setWallet({ address: "GABCDEFGH1234567890WXYZ", network: "TESTNET" });
    render(<ConnectPanel />);

    expect(screen.getByText("Connected: GABC...WXYZ (TESTNET)")).toBeInTheDocument();
    expect(screen.queryByText("Connect Freighter")).not.toBeInTheDocument();
  });

  it("disables the button and shows the connecting label while connecting", () => {
    setAuth(null);
    setWallet({ connecting: true });
    render(<ConnectPanel />);

    const button = screen.getByText("Connecting...");
    expect(button).toBeInTheDocument();
    expect(button.closest("button")).toBeDisabled();
  });

  it("renders the error message when present", () => {
    setAuth(null);
    setWallet({ error: "Install the Freighter wallet extension to continue." });
    render(<ConnectPanel />);

    expect(
      screen.getByText("Install the Freighter wallet extension to continue."),
    ).toBeInTheDocument();
  });

  it("renders no error paragraph when error is null", () => {
    setAuth(null);
    setWallet({ error: null });
    render(<ConnectPanel />);

    expect(screen.queryByText(/Install the Freighter/)).not.toBeInTheDocument();
  });

  it("calls connect() when the Connect Freighter button is clicked", () => {
    const connect = jest.fn();
    setAuth(null);
    setWallet({ connect });
    render(<ConnectPanel />);

    fireEvent.click(screen.getByText("Connect Freighter"));
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

describe("ConnectPanel — the four connection-state combinations", () => {
  it("neither connected: shows both CTAs", () => {
    setAuth(null);
    setWallet({ address: null });
    render(<ConnectPanel />);

    expect(screen.getByText("Continue with GitHub")).toBeInTheDocument();
    expect(screen.getByText("Connect Freighter")).toBeInTheDocument();
  });

  it("GitHub only: signed-in state + wallet CTA", () => {
    setAuth(USER);
    setWallet({ address: null });
    render(<ConnectPanel />);

    expect(screen.getByText("Signed in as @devrel_ana")).toBeInTheDocument();
    expect(screen.getByText("Connect Freighter")).toBeInTheDocument();
  });

  it("wallet only: GitHub CTA + connected wallet state", () => {
    setAuth(null);
    setWallet({ address: "GABCDEFGH1234567890WXYZ", network: "TESTNET" });
    render(<ConnectPanel />);

    expect(screen.getByText("Continue with GitHub")).toBeInTheDocument();
    expect(screen.getByText(/Connected:/)).toBeInTheDocument();
  });

  it("both connected: both signed-in states, no CTAs", () => {
    setAuth(USER);
    setWallet({ address: "GABCDEFGH1234567890WXYZ", network: "TESTNET" });
    render(<ConnectPanel />);

    expect(screen.getByText("Signed in as @devrel_ana")).toBeInTheDocument();
    expect(screen.getByText(/Connected:/)).toBeInTheDocument();
    expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect Freighter")).not.toBeInTheDocument();
  });

  it("shows wallet address mismatch banner when addresses differ", () => {
    const userWithDifferentAddress = {
      ...USER,
      stellarAddress: "GXYZABCD1234567890OPQR",
    };
    setAuth(userWithDifferentAddress);
    setWallet({ address: "GABCDEFGH1234567890WXYZ", network: "TESTNET" });
    render(<ConnectPanel />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Wallet address mismatch")).toBeInTheDocument();
    expect(screen.getByText(/The connected wallet/)).toBeInTheDocument();
    // The truncated connected address renders twice: once on the "Connected:"
    // status line and once inside the mismatch banner. getByText throws on
    // multiple matches, so assert both occurrences rather than picking one.
    expect(screen.getAllByText(/GABC\.\.\.WXYZ/).length).toBeGreaterThan(0);
    expect(screen.getByText(/GXYZ\.\.\.OPQR/)).toBeInTheDocument();
  });

  it("hides wallet address mismatch banner when addresses match", () => {
    const userWithMatchingAddress = {
      ...USER,
      stellarAddress: "GABCDEFGH1234567890WXYZ",
    };
    setAuth(userWithMatchingAddress);
    setWallet({ address: "GABCDEFGH1234567890WXYZ", network: "TESTNET" });
    render(<ConnectPanel />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Wallet address mismatch")).not.toBeInTheDocument();
  });

  it("hides mismatch banner when user has no stellarAddress", () => {
    setAuth(USER);
    setWallet({ address: "GABCDEFGH1234567890WXYZ", network: "TESTNET" });
    render(<ConnectPanel />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Wallet address mismatch")).not.toBeInTheDocument();
  });
});
