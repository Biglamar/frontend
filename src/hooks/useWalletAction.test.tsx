import { act, renderHook } from "@testing-library/react";
import { useWallet } from "@/context/WalletContext";
import { useWalletAction } from "./useWalletAction";

jest.mock("@/context/WalletContext", () => ({
  useWallet: jest.fn(),
}));

const mockUseWallet = useWallet as jest.Mock;

function setWallet(overrides: Partial<ReturnType<typeof useWallet>> = {}) {
  mockUseWallet.mockReturnValue({
    address: null,
    network: null,
    connecting: false,
    error: null,
    initializing: false,
    addressMismatch: false,
    networkMismatch: false,
    // A live re-check that agrees with the cached flag — the default for
    // every test that isn't specifically exercising the re-check.
    recheckNetworkMismatch: jest.fn().mockResolvedValue(false),
    linkState: "none",
    connect: jest.fn(),
    disconnect: jest.fn(),
    getError: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  mockUseWallet.mockReset();
});

describe("useWalletAction", () => {
  it("blocks signing when addressMismatch is set", async () => {
    const connect = jest.fn();
    setWallet({ addressMismatch: true, connect });
    const action = jest.fn();
    const { result } = renderHook(() => useWalletAction());

    let response: Awaited<ReturnType<typeof result.current.runWithWallet>>;
    await act(async () => {
      response = await result.current.runWithWallet(action, "Fallback message.");
    });

    expect(response!).toEqual({ ok: false, error: expect.stringContaining("active account has changed") });
    expect(connect).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  it("blocks signing when a live network re-check confirms the cached mismatch", async () => {
    const connect = jest.fn();
    const recheckNetworkMismatch = jest.fn().mockResolvedValue(true);
    setWallet({ networkMismatch: true, recheckNetworkMismatch, connect });
    const action = jest.fn();
    const { result } = renderHook(() => useWalletAction());

    let response: Awaited<ReturnType<typeof result.current.runWithWallet>>;
    await act(async () => {
      response = await result.current.runWithWallet(action, "Fallback message.");
    });

    expect(response!).toEqual({ ok: false, error: expect.stringContaining("wrong network") });
    expect(recheckNetworkMismatch).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  // The cached flag is only written on mount. A user who switches Freighter
  // back to the right network after that used to stay blocked for the rest of
  // the session — the stale `true` was authoritative — so the action is
  // re-checked rather than trusted.
  it("proceeds when a stale networkMismatch clears under a live re-check", async () => {
    const recheckNetworkMismatch = jest.fn().mockResolvedValue(false);
    setWallet({
      networkMismatch: true,
      recheckNetworkMismatch,
      address: "GCACHED",
      connect: jest.fn(),
    });
    const action = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useWalletAction());

    let response: Awaited<ReturnType<typeof result.current.runWithWallet>>;
    await act(async () => {
      response = await result.current.runWithWallet(action, "Fallback message.");
    });

    expect(response!).toEqual({ ok: true });
    expect(recheckNetworkMismatch).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("GCACHED");
  });

  it("does not spend a re-check when there is no mismatch to question", async () => {
    const recheckNetworkMismatch = jest.fn().mockResolvedValue(false);
    setWallet({
      networkMismatch: false,
      recheckNetworkMismatch,
      address: "GCACHED",
      connect: jest.fn(),
    });
    const action = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useWalletAction());

    await act(async () => {
      await result.current.runWithWallet(action, "Fallback message.");
    });

    expect(recheckNetworkMismatch).not.toHaveBeenCalled();
  });

  it("returns the fresh connection error when connect resolves without an address", async () => {
    const getError = jest.fn(() => "Wallet access was not granted.");
    setWallet({ connect: jest.fn().mockResolvedValue(null), getError });
    const { result } = renderHook(() => useWalletAction());
    let response: Awaited<ReturnType<typeof result.current.runWithWallet>>;

    await act(async () => {
      response = await result.current.runWithWallet(jest.fn(), "Fallback message.");
    });

    expect(response!).toEqual({ ok: false, error: "Wallet access was not granted." });
    expect(getError).toHaveBeenCalledTimes(1);
  });

  it("runs the action with the connected wallet address", async () => {
    setWallet({ connect: jest.fn().mockResolvedValue("GCONNECTED") });
    const action = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useWalletAction());

    await act(async () => {
      await expect(
        result.current.runWithWallet(action, "Fallback message."),
      ).resolves.toEqual({ ok: true });
    });

    expect(action).toHaveBeenCalledWith("GCONNECTED");
  });
});

describe("useWalletAction — wallet still initializing (#456)", () => {
  // `address` is null until WalletContext has read localStorage. A click in
  // that window took the `address ?? await connect()` path and re-prompted
  // Freighter for a wallet the user had already connected.
  it("blocks rather than re-prompting for a wallet mid-hydration", async () => {
    const connect = jest.fn();
    setWallet({ initializing: true, connect });
    const action = jest.fn();
    const { result } = renderHook(() => useWalletAction());

    let response: Awaited<ReturnType<ReturnType<typeof useWalletAction>["runWithWallet"]>>;
    await act(async () => {
      response = await result.current.runWithWallet(action, "Fallback message.");
    });

    expect(response!).toEqual({ ok: false, error: expect.stringContaining("Still checking") });
    expect(connect).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  it("proceeds normally once initialization finishes", async () => {
    setWallet({
      initializing: false,
      address: "GCACHED",
      connect: jest.fn().mockResolvedValue("GCACHED"),
    });
    const action = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useWalletAction());

    await act(async () => {
      await expect(
        result.current.runWithWallet(action, "Fallback message."),
      ).resolves.toEqual({ ok: true });
    });

    expect(action).toHaveBeenCalledWith("GCACHED");
  });
});
