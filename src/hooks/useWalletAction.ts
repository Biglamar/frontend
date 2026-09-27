import { useWallet } from "@/context/WalletContext";

type WalletActionResult = { ok: true } | { ok: false; error: string };

const ADDRESS_MISMATCH_ERROR =
  "Freighter's active account has changed. Please disconnect and reconnect your wallet to continue.";
const NETWORK_MISMATCH_ERROR =
  "Your Freighter wallet is on the wrong network. Switch it in the extension and try again.";
const INITIALIZING_ERROR =
  "Still checking your wallet connection. Please try again in a moment.";

export function useWalletAction() {
  const {
    address,
    connect,
    connecting,
    initializing,
    addressMismatch,
    networkMismatch,
    getError,
  } = useWallet();

  async function runWithWallet(
    action: (walletAddress: string) => Promise<unknown>,
    connectError: string,
  ): Promise<WalletActionResult> {
    if (addressMismatch) return { ok: false, error: ADDRESS_MISMATCH_ERROR };
    if (networkMismatch) return { ok: false, error: NETWORK_MISMATCH_ERROR };
    // `address` is null until WalletContext has read the cached address out of
    // localStorage. Without this guard a click in that window took the
    // `address ?? await connect()` path and re-prompted Freighter for a wallet
    // the user had already connected (#456).
    if (initializing) return { ok: false, error: INITIALIZING_ERROR };

    const walletAddress = address ?? (await connect());
    if (!walletAddress) {
      return { ok: false, error: getError() ?? connectError };
    }

    await action(walletAddress);
    return { ok: true };
  }

  return { runWithWallet, connecting };
}