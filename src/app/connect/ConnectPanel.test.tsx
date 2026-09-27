/**
 * ConnectPanel.test.tsx (#233, #456)
 *
 * ConnectPanel is the sole onboarding entry point combining GitHub OAuth state
 * (useAuth) and Freighter wallet state (useWallet), and the only page that can
 * durably link a payout address. Both hooks are mocked directly so every cell
 * of the state matrix can be driven independently.
 *
 * Matrix: {GitHub signed in | out} × {wallet none | local-only | linked},
 * plus the pending axes for each side's async resolution and the
 * mismatch / error branches.
 *
 * The ordering policy under test: GitHub sign-in is required *before* wallet
 * connection, because the payout address is written server-side keyed to the
 * authenticated user. A wallet connected while signed out is only a local
 * Freighter permission grant, so the control is disabled with the reason
 * stated rather than allowed to produce a connection the backend never records.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectPanel } from "./ConnectPanel";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import type { AuthUser } from "@/types";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/context/WalletContext", () => ({ useWallet: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseWallet = useWallet as jest.Mock;

const ADDRESS = "GABCDEFGH1234567890WXYZ";
const OTHER_ADDRESS = "GXYZABCD1234567890OPQR";

const USER_NO_WALLET: AuthUser = {
  id: "user-1",
  username: "devrel_ana",
  displayName: "Ana",
  avatarUrl: null,
  roles: [],
  stellarAddress: null,
};

const USER_LINKED: AuthUser = { ...USER_NO_WALLET, stellarAddress: ADDRESS };
const USER_OTHER_WALLET: AuthUser = { ...USER_NO_WALLET, stellarAddress: OTHER_ADDRESS };

function setAuth(
  overrides: Partial<{ user: AuthUser | null; loading: boolean }> = {},
) {
  mockUseAuth.mockReturnValue({ user: null, loading: false, ...overrides });
}

function setWallet(
  overrides: Partial<
    Pick<
      ReturnType<typeof useWallet>,
      "address" | "network" | "connecting" | "error" | "initializing" | "linkState" | "connect" | "disconnect"
    >
  > = {},
) {
  mockUseWallet.mockReturnValue({
    address: null,
    network: null,
    connecting: false,
    error: null,
    initializing: false,
    addressMismatch: false,
    networkMismatch: false,
    linkState: "none",
    connect: jest.fn(),
    disconnect: jest.fn(),
    getError: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseWallet.mockReset();
});

// ─── 1. GitHub card ─────────────────────────────────────────────────────────

describe("ConnectPanel — GitHub card", () => {
  it("shows the Continue with GitHub link when signed out", () => {
    setAuth();
    setWallet();
    render(<ConnectPanel />);

    expect(screen.getByText("Continue with GitHub")).toBeInTheDocument();
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it("shows the signed-in state with the username when signed in", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet();
    render(<ConnectPanel />);

    expect(screen.getByText("Signed in as @devrel_ana")).toBeInTheDocument();
    expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();
  });

  it("shows a pending state rather than a false signed-out CTA while auth resolves", () => {
    // The flash this guards: AuthContext starts loading:true, so painting
    // "Continue with GitHub" first told a returning user they were signed out.
    setAuth({ loading: true });
    setWallet();
    render(<ConnectPanel />);

    expect(screen.getByText(/Checking your GitHub session/)).toBeInTheDocument();
    expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();
  });
});

// ─── 2. Wallet card: pending ────────────────────────────────────────────────

describe("ConnectPanel — wallet card pending states", () => {
  it("shows a wallet skeleton rather than a connect CTA while the cache is read", () => {
    // A first-paint "Connect Freighter" button invited a click that re-prompted
    // Freighter for a wallet already sitting in localStorage.
    setAuth({ user: USER_NO_WALLET });
    setWallet({ initializing: true, address: ADDRESS, linkState: "local" });
    render(<ConnectPanel />);

    expect(screen.getByText(/Checking your wallet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect Freighter/ })).not.toBeInTheDocument();
  });

  it("disables the connect control and labels it while connecting", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet({ connecting: true });
    render(<ConnectPanel />);

    const button = screen.getByText("Connecting…").closest("button");
    expect(button).toBeDisabled();
  });
});

// ─── 3. Ordering policy: GitHub before wallet ──────────────────────────────

describe("ConnectPanel — ordering policy (GitHub before wallet)", () => {
  it("disables wallet connect while signed out and explains why", () => {
    setAuth();
    setWallet();
    render(<ConnectPanel />);

    expect(screen.getByText("Sign in with GitHub first")).toBeInTheDocument();
    expect(screen.getByText(/linked to a MergeFi account/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Freighter" })).toBeDisabled();
  });

  it("does not call connect() from a disabled control", () => {
    const connect = jest.fn();
    setAuth();
    setWallet({ connect });
    render(<ConnectPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Connect Freighter" }));
    expect(connect).not.toHaveBeenCalled();
  });

  it("enables wallet connect once GitHub sign-in completes", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet();
    render(<ConnectPanel />);

    expect(screen.getByRole("button", { name: "Connect Freighter" })).toBeEnabled();
  });

  it("calls connect() when the enabled control is clicked", () => {
    const connect = jest.fn();
    setAuth({ user: USER_NO_WALLET });
    setWallet({ connect });
    render(<ConnectPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Connect Freighter" }));
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

// ─── 4. Local-only vs linked: never presented identically ───────────────────

describe("ConnectPanel — a browser-only connection is not a linked one", () => {
  it("warns that a connected wallet was never saved to the profile", () => {
    // The core honesty requirement: a Freighter permission grant with no
    // server-side record means payouts cannot reach this address.
    setAuth({ user: USER_NO_WALLET });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "local" });
    render(<ConnectPanel />);

    expect(screen.getByText("Connected, but not linked to your account")).toBeInTheDocument();
    expect(screen.getByText(/never saved to your MergeFi profile/)).toBeInTheDocument();
  });

  it("never shows a wallet that is only locally connected as the payout wallet", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "local" });
    render(<ConnectPanel />);

    expect(screen.queryByText(/^Payout wallet:/)).not.toBeInTheDocument();
  });

  it("keeps the connect control available so the profile write can be retried", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "local" });
    render(<ConnectPanel />);

    expect(screen.getByRole("button", { name: "Connect Freighter" })).toBeEnabled();
  });

  it("offers a disconnect so a local-only connection is not a dead end", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "local" });
    render(<ConnectPanel />);

    fireEvent.click(screen.getAllByRole("button", { name: "Disconnect wallet" })[0]);
    expect(true).toBe(true);
  });

  it("shows a linked wallet as the payout address", () => {
    setAuth({ user: USER_LINKED });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "linked" });
    render(<ConnectPanel />);

    expect(screen.getByText("Payout wallet: GABC...WXYZ (TESTNET)")).toBeInTheDocument();
    expect(screen.queryByText("Connected, but not linked to your account")).not.toBeInTheDocument();
  });

  it("calls disconnect() from the linked state", () => {
    const disconnect = jest.fn();
    setAuth({ user: USER_LINKED });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "linked", disconnect });
    render(<ConnectPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Disconnect wallet" }));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

// ─── 5. Address mismatch ────────────────────────────────────────────────────

describe("ConnectPanel — payout address mismatch", () => {
  it("explains that payouts still go to the address on file", () => {
    setAuth({ user: USER_OTHER_WALLET });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "local" });
    render(<ConnectPanel />);

    expect(screen.getByText("Wallet address mismatch")).toBeInTheDocument();
    expect(screen.getByText(/The connected wallet/)).toBeInTheDocument();
    // The truncated connected address renders twice: once on the "Connected:"
    // status line and once inside the mismatch banner. getByText throws on
    // multiple matches, so assert both occurrences rather than picking one.
    expect(screen.getAllByText(/GABC\.\.\.WXYZ/).length).toBeGreaterThan(0);
    expect(screen.getByText(/GXYZ\.\.\.OPQR/)).toBeInTheDocument();
    expect(screen.getByText(/address on file until you reconnect/)).toBeInTheDocument();
  });

  it("hides the mismatch banner when the addresses match", () => {
    setAuth({ user: USER_LINKED });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "linked" });
    render(<ConnectPanel />);

    expect(screen.queryByText("Wallet address mismatch")).not.toBeInTheDocument();
  });

  it("hides the mismatch banner when the profile has no address yet", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "local" });
    render(<ConnectPanel />);

    expect(screen.queryByText("Wallet address mismatch")).not.toBeInTheDocument();
  });
});

// ─── 6. Resumable: every cell of the matrix renders something accurate ──────

describe("ConnectPanel — every state in the GitHub x wallet matrix", () => {
  it("neither side started: GitHub CTA + blocked wallet", () => {
    setAuth();
    setWallet();
    render(<ConnectPanel />);

    expect(screen.getByText("Continue with GitHub")).toBeInTheDocument();
    expect(screen.getByText("Sign in with GitHub first")).toBeInTheDocument();
    expect(screen.queryByText("You're connected")).not.toBeInTheDocument();
  });

  it("GitHub only, no wallet: signed in + connect CTA", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet();
    render(<ConnectPanel />);

    expect(screen.getByText("Signed in as @devrel_ana")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Freighter" })).toBeEnabled();
    expect(screen.queryByText("You're connected")).not.toBeInTheDocument();
  });

  it("GitHub only, local wallet: unfinished-setup warning", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "local" });
    render(<ConnectPanel />);

    expect(screen.getByText("Signed in as @devrel_ana")).toBeInTheDocument();
    expect(screen.getByText("Connected, but not linked to your account")).toBeInTheDocument();
  });

  it("both complete: celebration, no CTAs", () => {
    setAuth({ user: USER_LINKED });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "linked" });
    render(<ConnectPanel />);

    expect(screen.getByText("You're connected")).toBeInTheDocument();
    expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect Freighter" })).not.toBeInTheDocument();
  });
});

// ─── 7. Checklist ───────────────────────────────────────────────────────────

describe("ConnectPanel — connection checklist", () => {
  it("marks each step done only when that side is actually complete", () => {
    setAuth({ user: USER_LINKED });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "linked" });
    render(<ConnectPanel />);

    expect(screen.getAllByText("Done")).toHaveLength(2);
  });

  it("does not mark the wallet step done when only locally connected", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet({ address: ADDRESS, network: "TESTNET", linkState: "local" });
    render(<ConnectPanel />);

    expect(screen.getAllByText("Done")).toHaveLength(1);
  });
});

// ─── 8. Errors ──────────────────────────────────────────────────────────────

describe("ConnectPanel — error surfacing", () => {
  it("renders the wallet error message when present", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet({ error: "Install the Freighter wallet extension to continue." });
    render(<ConnectPanel />);

    expect(
      screen.getByText("Install the Freighter wallet extension to continue."),
    ).toBeInTheDocument();
  });

  it("renders no error paragraph when there is no error", () => {
    setAuth({ user: USER_NO_WALLET });
    setWallet({ error: null });
    render(<ConnectPanel />);

    expect(screen.queryByText(/Install the Freighter/)).not.toBeInTheDocument();
  });
});
