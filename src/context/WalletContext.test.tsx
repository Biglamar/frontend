import { useState } from "react";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import { WalletProvider, useWallet } from "./WalletContext";
import { useAuth } from "@/context/AuthContext";
import {
  checkNetworkMismatch,
  connectWallet,
  getActiveFreighterAddress,
} from "@/lib/wallet";
import { apiRequest } from "@/lib/api";

const WALLET_KEY = "mergefi_wallet_address";

jest.mock("@/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/wallet", () => ({
  connectWallet: jest.fn(),
  // Added for #71/#2 (reconciling a restored address/network against
  // Freighter's live state on mount) — this mock predated both and was
  // missing them entirely, so any test path that reaches the deferred
  // mount-hydration effect threw `is not a function`. Default to "nothing
  // to reconcile" (no live address, no network mismatch); tests that care
  // about the mismatch paths specifically override these.
  getActiveFreighterAddress: jest.fn().mockResolvedValue(null),
  checkNetworkMismatch: jest.fn().mockResolvedValue(null),
}));

// WalletContext imports apiRequest for profile linking on connect(), which
// pulls in src/lib/config.ts's env validation at module-load time — not
// exercised by these cross-tab tests, so it's mocked out like @/lib/wallet.
jest.mock("@/lib/api", () => ({
  apiRequest: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetActiveFreighterAddress = getActiveFreighterAddress as jest.Mock;
const mockCheckNetworkMismatch = checkNetworkMismatch as jest.Mock;
const mockConnectWallet = connectWallet as jest.Mock;
const mockApiRequest = apiRequest as jest.Mock;
const mockRefresh = jest.fn();

function TestConsumer() {
  const {
    address,
    connecting,
    error,
    addressMismatch,
    networkMismatch,
    initializing,
    linkState,
    network,
    connect,
    disconnect,
    getError,
    recheckNetworkMismatch,
  } = useWallet();
  const [readAfterConnect, setReadAfterConnect] =
    useState<string>("not-read-yet");
  const [recheckResult, setRecheckResult] = useState<string>("not-rechecked");

  return (
    <div>
      <div data-testid="address">{address ?? "disconnected"}</div>
      <div data-testid="network">{network ?? "no-network"}</div>
      <div data-testid="connecting">{String(connecting)}</div>
      <div data-testid="error">{error ?? "none"}</div>
      <div data-testid="address-mismatch">{String(addressMismatch)}</div>
      <div data-testid="network-mismatch">{String(networkMismatch)}</div>
      <div data-testid="initializing">{String(initializing)}</div>
      <div data-testid="link-state">{linkState}</div>
      <div data-testid="read-after-connect">{readAfterConnect}</div>
      <div data-testid="recheck-result">{recheckResult}</div>
      <button onClick={() => void connect()}>connect</button>
      <button onClick={disconnect}>disconnect</button>
      <button
        onClick={async () => {
          await connect();
          // Mirrors IssueActions/MilestoneActions' pattern: read getError()
          // synchronously right after the awaited connect() settles.
          setReadAfterConnect(getError() ?? "none");
        }}
      >
        connect-and-read-getError
      </button>
      <button
        onClick={async () => {
          const stillMismatched = await recheckNetworkMismatch();
          setRecheckResult(String(stillMismatched));
        }}
      >
        recheck-network
      </button>
    </div>
  );
}

function dispatchWalletStorageEvent(newValue: string | null) {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: WALLET_KEY,
      newValue,
      storageArea: window.localStorage,
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  mockUseAuth.mockReturnValue({ user: null, loading: false, refresh: mockRefresh });
  mockGetActiveFreighterAddress.mockResolvedValue(null);
  mockCheckNetworkMismatch.mockResolvedValue(null);
  mockConnectWallet.mockReset();
  mockApiRequest.mockReset();
  mockRefresh.mockReset();
});

describe("WalletContext — mount reconciliation (#402)", () => {
  it("detects cached address and network mismatches after mount", async () => {
    window.localStorage.setItem(WALLET_KEY, "GCACHEDADDRESS");
    mockGetActiveFreighterAddress.mockResolvedValue("GDIFFERENTADDRESS");
    mockCheckNetworkMismatch.mockResolvedValue("Wrong network");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("GCACHEDADDRESS");
      expect(screen.getByTestId("address-mismatch")).toHaveTextContent("true");
      expect(screen.getByTestId("network-mismatch")).toHaveTextContent("true");
    });
  });

  it("clears both mismatch flags after a successful connection", async () => {
    window.localStorage.setItem(WALLET_KEY, "GCACHEDADDRESS");
    mockGetActiveFreighterAddress.mockResolvedValue("GDIFFERENTADDRESS");
    mockCheckNetworkMismatch.mockResolvedValue("Wrong network");
    mockConnectWallet.mockResolvedValue({
      address: "GNEWADDRESS",
      network: "TESTNET",
    });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("address-mismatch")).toHaveTextContent("true");
      expect(screen.getByTestId("network-mismatch")).toHaveTextContent("true");
    });

    fireEvent.click(screen.getByText("connect"));

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("GNEWADDRESS");
      expect(screen.getByTestId("address-mismatch")).toHaveTextContent("false");
      expect(screen.getByTestId("network-mismatch")).toHaveTextContent("false");
    });
  });
});

describe("WalletContext — cross-tab sync (issue #84)", () => {
  it("adopts an address connected in another tab", async () => {
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent("disconnected"),
    );

    act(() => {
      dispatchWalletStorageEvent("GABC123FROMANOTHERTAB");
    });

    expect(screen.getByTestId("address")).toHaveTextContent(
      "GABC123FROMANOTHERTAB",
    );
  });

  it("clears the address when disconnected in another tab", async () => {
    window.localStorage.setItem(WALLET_KEY, "GABC123ALREADYCONNECTED");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent(
        "GABC123ALREADYCONNECTED",
      ),
    );

    act(() => {
      dispatchWalletStorageEvent(null);
    });

    expect(screen.getByTestId("address")).toHaveTextContent("disconnected");
  });

  it("ignores storage events for unrelated keys", async () => {
    window.localStorage.setItem(WALLET_KEY, "GABC123ALREADYCONNECTED");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent(
        "GABC123ALREADYCONNECTED",
      ),
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "mergefi_token",
          newValue: null,
          storageArea: window.localStorage,
        }),
      );
    });

    expect(screen.getByTestId("address")).toHaveTextContent(
      "GABC123ALREADYCONNECTED",
    );
  });
});

describe("WalletContext — connect() (#231)", () => {
  it("sets address/network and returns the address on a successful connection", async () => {
    mockConnectWallet.mockResolvedValue({
      address: "GNEWADDRESS",
      network: "TESTNET",
    });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));

    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent("GNEWADDRESS"),
    );
    expect(screen.getByTestId("connecting")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    expect(window.localStorage.getItem(WALLET_KEY)).toBe("GNEWADDRESS");
  });

  it("sets error and leaves address null when connectWallet() rejects", async () => {
    mockConnectWallet.mockRejectedValue(
      new Error("Install the Freighter wallet extension to continue."),
    );

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Install the Freighter wallet extension to continue.",
      ),
    );
    expect(screen.getByTestId("address")).toHaveTextContent("disconnected");
    expect(screen.getByTestId("connecting")).toHaveTextContent("false");
  });

  it("sets a distinct error when the wallet connects but the profile-link PATCH fails (#229)", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      refresh: mockRefresh,
    });
    mockConnectWallet.mockResolvedValue({
      address: "GNEWADDRESS",
      network: "TESTNET",
    });
    mockApiRequest.mockRejectedValue(new Error("network error"));

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));

    // The wallet itself still connects successfully...
    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent("GNEWADDRESS"),
    );
    // ...but the profile-link failure is surfaced, not swallowed.
    expect(screen.getByTestId("error")).toHaveTextContent(
      "Wallet connected, but couldn't save it to your profile — try reconnecting.",
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("links the profile and refreshes the session when connected and signed in", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      refresh: mockRefresh,
    });
    mockConnectWallet.mockResolvedValue({
      address: "GNEWADDRESS",
      network: "TESTNET",
    });
    mockApiRequest.mockResolvedValue(undefined);

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockApiRequest).toHaveBeenCalledWith(
      "/users/user-1/stellar-address",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("getError() returns the fresh failure reason synchronously right after connect() settles (#235)", async () => {
    mockConnectWallet.mockRejectedValue(
      new Error("Wallet access was not granted."),
    );

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect-and-read-getError"));

    // The consumer read getError() immediately after `await connect()`
    // resolved in its own click handler — not from a later render's
    // `error` prop — and still got the correct, specific message.
    await waitFor(() =>
      expect(screen.getByTestId("read-after-connect")).toHaveTextContent(
        "Wallet access was not granted.",
      ),
    );
  });
});

describe("WalletContext — disconnect() (#230, #231)", () => {
  it("clears local address/network state and localStorage", async () => {
    mockConnectWallet.mockResolvedValue({
      address: "GNEWADDRESS",
      network: "TESTNET",
    });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent("GNEWADDRESS"),
    );

    fireEvent.click(screen.getByText("disconnect"));

    expect(screen.getByTestId("address")).toHaveTextContent("disconnected");
    expect(window.localStorage.getItem(WALLET_KEY)).toBeNull();
  });

  it("does not call the backend when disconnecting while signed out", async () => {
    mockConnectWallet.mockResolvedValue({
      address: "GNEWADDRESS",
      network: "TESTNET",
    });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent("GNEWADDRESS"),
    );

    fireEvent.click(screen.getByText("disconnect"));

    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("unlinks stellarAddress on the backend when disconnecting while signed in (#230)", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      refresh: mockRefresh,
    });
    mockConnectWallet.mockResolvedValue({
      address: "GNEWADDRESS",
      network: "TESTNET",
    });
    mockApiRequest.mockResolvedValue(undefined);

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent("GNEWADDRESS"),
    );
    mockApiRequest.mockClear();

    fireEvent.click(screen.getByText("disconnect"));

    // Local state clears synchronously regardless of the backend call...
    expect(screen.getByTestId("address")).toHaveTextContent("disconnected");
    // ...and the unlink PATCH is fired.
    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith(
        "/users/user-1/stellar-address",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ stellarAddress: null }),
        }),
      ),
    );
  });

  it("still clears local state even when the backend unlink call fails", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
      refresh: mockRefresh,
    });
    mockConnectWallet.mockResolvedValue({
      address: "GNEWADDRESS",
      network: "TESTNET",
    });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent("GNEWADDRESS"),
    );
    mockApiRequest.mockRejectedValue(new Error("network error"));

    fireEvent.click(screen.getByText("disconnect"));

    expect(screen.getByTestId("address")).toHaveTextContent("disconnected");
    expect(window.localStorage.getItem(WALLET_KEY)).toBeNull();
  });
});

describe("WalletContext — initializing flag (#456)", () => {
  // Previously there was no way to tell "still reading localStorage" from "not
  // connected". On first paint `address` was null, so the Connect CTA rendered
  // and a click inside the setTimeout(0) window re-prompted Freighter for a
  // wallet that was already cached.
  it("reports initializing=true on the very first render", () => {
    window.localStorage.setItem(WALLET_KEY, "GCACHEDADDRESS");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    expect(screen.getByTestId("initializing")).toHaveTextContent("true");
  });

  it("clears initializing once the cache has been read", async () => {
    window.localStorage.setItem(WALLET_KEY, "GCACHEDADDRESS");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
  });

  it("clears initializing for a first-time visitor with no cached address", async () => {
    // Otherwise a visitor who has never connected a wallet is stuck on a
    // pending state forever, since the old code only touched the flag inside
    // the `if (stored)` branch.
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
    expect(screen.getByTestId("link-state")).toHaveTextContent("none");
  });
});

describe("WalletContext — linkState (#456)", () => {
  const ADDRESS = "GNEWADDRESS";

  it("is 'none' with no address", async () => {
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
    expect(screen.getByTestId("link-state")).toHaveTextContent("none");
  });

  it("is 'local' when connected while signed out — never 'linked'", async () => {
    // The backend only learns the payout address through a PATCH keyed to an
    // authenticated user, so a signed-out connection is a browser-local
    // Freighter grant that no payout can reach. Reporting "linked" here is
    // exactly the false confidence this state exists to prevent.
    mockConnectWallet.mockResolvedValue({ address: ADDRESS, network: "TESTNET" });

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() => expect(screen.getByTestId("link-state")).toHaveTextContent("local"));
    // ...and nothing was written to the backend.
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("is 'linked' only when the profile address matches the connected one", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", stellarAddress: ADDRESS },
      loading: false,
      refresh: mockRefresh,
    });
    mockConnectWallet.mockResolvedValue({ address: ADDRESS, network: "TESTNET" });
    mockApiRequest.mockResolvedValue(undefined);

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() => expect(screen.getByTestId("link-state")).toHaveTextContent("linked"));
  });

  it("is 'local', not 'linked', when the profile holds a different address", async () => {
    // Payouts still go to the on-file address, so presenting this as complete
    // would misdescribe where the money goes.
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", stellarAddress: "GDIFFERENTADDRESS" },
      loading: false,
      refresh: mockRefresh,
    });
    mockConnectWallet.mockResolvedValue({ address: ADDRESS, network: "TESTNET" });
    mockApiRequest.mockResolvedValue(undefined);

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() => expect(screen.getByTestId("link-state")).toHaveTextContent("local"));
  });

  it("stays 'local' when the profile PATCH fails, so the UI can offer a retry", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", stellarAddress: null },
      loading: false,
      refresh: mockRefresh,
    });
    mockConnectWallet.mockResolvedValue({ address: ADDRESS, network: "TESTNET" });
    mockApiRequest.mockRejectedValue(new Error("network error"));

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() => expect(screen.getByTestId("link-state")).toHaveTextContent("local"));
  });
});

describe("WalletContext — disconnect() clears every derived flag (#456)", () => {
  it("clears the mismatch flags that used to survive and block all actions", async () => {
    // `useWalletAction` hard-blocks on addressMismatch/networkMismatch, so a
    // disconnect that left them set produced a loop: "disconnect and reconnect
    // to continue" with the reconnect then also blocked.
    window.localStorage.setItem(WALLET_KEY, "GCACHEDADDRESS");
    mockGetActiveFreighterAddress.mockResolvedValue("GDIFFERENTADDRESS");
    mockCheckNetworkMismatch.mockResolvedValue("Wrong network");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("address-mismatch")).toHaveTextContent("true");
      expect(screen.getByTestId("network-mismatch")).toHaveTextContent("true");
    });

    fireEvent.click(screen.getByText("disconnect"));

    expect(screen.getByTestId("address-mismatch")).toHaveTextContent("false");
    expect(screen.getByTestId("network-mismatch")).toHaveTextContent("false");
  });

  it("clears a stale connect() error, which used to persist indefinitely", async () => {
    mockConnectWallet.mockRejectedValue(new Error("Wallet access was not granted."));

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Wallet access was not granted."),
    );

    fireEvent.click(screen.getByText("disconnect"));
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("refreshes the session after a successful unlink", async () => {
    // Otherwise AuthUser.stellarAddress stays set on the client and the nav
    // keeps showing a payout address the user just removed.
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", stellarAddress: "GNEWADDRESS" },
      loading: false,
      refresh: mockRefresh,
    });
    mockConnectWallet.mockResolvedValue({ address: "GNEWADDRESS", network: "TESTNET" });
    mockApiRequest.mockResolvedValue(undefined);

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() => expect(screen.getByTestId("link-state")).toHaveTextContent("linked"));

    mockApiRequest.mockClear();
    fireEvent.click(screen.getByText("disconnect"));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});

describe("WalletContext — cross-tab adopt sets the network (#456)", () => {
  it("does not render an adopted address with an empty network", async () => {
    // Only the null branch used to set `network`, so an address adopted from
    // another tab rendered as "Connected: GABC…WXYZ ()".
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));

    act(() => {
      dispatchWalletStorageEvent("GABC123FROMANOTHERTAB");
    });

    expect(screen.getByTestId("address")).toHaveTextContent("GABC123FROMANOTHERTAB");
    expect(screen.getByTestId("network")).not.toHaveTextContent("no-network");
  });

  it("re-derives a stale mismatch flag when the cached address changes", async () => {
    window.localStorage.setItem(WALLET_KEY, "GORIGINAL");
    mockGetActiveFreighterAddress.mockResolvedValue("GDIFFERENTADDRESS");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("address-mismatch")).toHaveTextContent("true"),
    );

    act(() => {
      dispatchWalletStorageEvent("GABC123FROMANOTHERTAB");
    });

    expect(screen.getByTestId("address-mismatch")).toHaveTextContent("false");
  });
});

describe("WalletContext — stale address is cleared once auth resolves (#456)", () => {
  // The clearing effect's only dep used to be `user`, and `user` starts null on
  // a cold load — so a visitor arriving with a cached wallet address and no
  // valid session never transitioned `user`, the effect never ran, and the
  // stale address stayed usable. `useWalletAction` would then fund a bounty
  // against it with no connect() call and no profile write.
  it("waits for the auth check rather than deciding on the initial null user", async () => {
    window.localStorage.setItem(WALLET_KEY, "GSTALEADDRESS");
    // Auth still resolving.
    mockUseAuth.mockReturnValue({ user: null, loading: true, refresh: mockRefresh });

    const { rerender } = render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    // The cached address is readable while auth is still resolving, and is
    // deliberately NOT cleared yet — we do not know yet whether there is a
    // session it belongs to.
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GSTALEADDRESS"));
    expect(window.localStorage.getItem(WALLET_KEY)).toBe("GSTALEADDRESS");

    // Auth finishes, with no session.
    mockUseAuth.mockReturnValue({ user: null, loading: false, refresh: mockRefresh });
    rerender(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("disconnected"));
    expect(window.localStorage.getItem(WALLET_KEY)).toBeNull();
  });
});

describe("WalletContext — recheckNetworkMismatch (issue #4: stale flag blocked actions)", () => {
  it("clears a mismatch the user has since fixed inside the extension", async () => {
    window.localStorage.setItem(WALLET_KEY, "GCACHEDADDRESS");
    mockCheckNetworkMismatch.mockResolvedValue("Wrong network");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("network-mismatch")).toHaveTextContent("true"),
    );

    // The user switches to the configured network in Freighter. Nothing
    // re-runs the mount-time check, so the flag used to stay true forever
    // and `useWalletAction` refused to run any action for the session.
    mockCheckNetworkMismatch.mockResolvedValue(null);
    await act(async () => {
      fireEvent.click(screen.getByText("recheck-network"));
    });

    expect(screen.getByTestId("recheck-result")).toHaveTextContent("false");
    expect(screen.getByTestId("network-mismatch")).toHaveTextContent("false");
  });

  it("returns true and keeps the flag while the wallet is still misconfigured", async () => {
    window.localStorage.setItem(WALLET_KEY, "GCACHEDADDRESS");
    mockCheckNetworkMismatch.mockResolvedValue("Wrong network");

    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("network-mismatch")).toHaveTextContent("true"),
    );

    await act(async () => {
      fireEvent.click(screen.getByText("recheck-network"));
    });

    expect(screen.getByTestId("recheck-result")).toHaveTextContent("true");
    expect(screen.getByTestId("network-mismatch")).toHaveTextContent("true");
  });

  it("reports no mismatch for a reader with no cached connection", async () => {
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("recheck-network"));
    });

    expect(screen.getByTestId("recheck-result")).toHaveTextContent("false");
    expect(screen.getByTestId("network-mismatch")).toHaveTextContent("false");
  });
});
