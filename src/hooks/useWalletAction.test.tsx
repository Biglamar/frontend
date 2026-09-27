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
  it.each([
    ["addressMismatch", "Freighter's active account has changed."],
    ["networkMismatch", "Your Freighter wallet is on the wrong network."],
  ] as const)("blocks signing when %s is set", async (mismatch, message) => {
    const connect = jest.fn();
    setWallet({ [mismatch]: true, connect } as Partial<ReturnType<typeof useWallet>>);
    const action = jest.fn();
    const { result } = renderHook(() => useWalletAction());

    let response: Awaited<ReturnType<typeof result.current.runWithWallet>>;
    await act(async () => {
      response = await result.current.runWithWallet(action, "Fallback message.");
    });

    expect(response!).toEqual({ ok: false, error: expect.stringContaining(message) });
    expect(connect).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
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
