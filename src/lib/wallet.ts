import {
  isConnected as freighterIsConnected,
  isAllowed,
  setAllowed,
  getAddress,
  getNetwork,
  signTransaction as freighterSignTransaction,
  signMessage as freighterSignMessage,
} from "@stellar/freighter-api";
import { STELLAR_NETWORK } from "./config";
import type { StellarNetwork } from "./env";

export interface WalletConnection {
  address: string;
  network: string;
}

/**
 * Single source of truth for network passphrases (#357). Keyed by
 * `StellarNetwork`, so adding a network to that type without a passphrase
 * here is a compile error.
 */
export const NETWORK_PASSPHRASES: Record<StellarNetwork, string> = {
  PUBLIC: "Public Global Stellar Network ; September 2015",
  TESTNET: "Test SDF Network ; September 2015",
};

/**
 * Read the network passphrase the Freighter extension is currently set to.
 * Returns null if the extension doesn't support getNetwork or isn't
 * reachable — callers should treat null as "unknown, proceed with caution."
 */
export async function getFreighterNetwork(): Promise<string | null> {
  try {
    const result = await getNetwork();
    if (result.error || !result.network) return null;
    return result.network;
  } catch {
    return null;
  }
}

/**
 * Check whether Freighter's active network matches the app's configured
 * network. Returns a human-readable mismatch message if they differ, or
 * null if they match (or the check couldn't be performed).
 */
export async function checkNetworkMismatch(): Promise<string | null> {
  const freighterNetwork = await getFreighterNetwork();
  if (!freighterNetwork) return null;
  const expected = NETWORK_PASSPHRASES[STELLAR_NETWORK];
  if (!expected) return null;
  if (freighterNetwork === expected) return null;
  return `Your Freighter wallet is on the wrong network. Switch it to ${STELLAR_NETWORK === "PUBLIC" ? "Mainnet" : "Testnet"} and try again.`;
}

export async function isFreighterInstalled(): Promise<boolean> {
  const result = await freighterIsConnected();
  return !result.error && result.isConnected;
}

/**
 * Passively read the currently-active Freighter address without prompting
 * the user for permission. Returns null if Freighter is not installed,
 * not connected, or not allowed — this is a read-only check, not a connect
 * action. Used by WalletContext to reconcile a cached localStorage address
 * against the extension's actual active account (#71).
 */
export async function getActiveFreighterAddress(): Promise<string | null> {
  try {
    if (!(await isFreighterInstalled())) return null;
    const allowed = await isAllowed();
    if (!allowed.isAllowed) return null;
    const { address, error } = await getAddress();
    if (error || !address) return null;
    return address;
  } catch {
    return null;
  }
}

export async function connectWallet(): Promise<WalletConnection> {
  if (!(await isFreighterInstalled())) {
    throw new Error("Install the Freighter wallet extension to continue.");
  }
  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    const granted = await setAllowed();
    if (granted.error || !granted.isAllowed) {
      throw new Error("Wallet access was not granted.");
    }
  }
  const { address, error } = await getAddress();
  if (error || !address) {
    throw new Error(error?.message ?? "Unable to read wallet address.");
  }
  // Pre-flight: verify the extension's network matches the app's.
  // A mismatch means any signed transaction will be rejected by Soroban,
  // but only after the user has already approved it in the extension (#2).
  const mismatchMsg = await checkNetworkMismatch();
  if (mismatchMsg) {
    throw new Error(mismatchMsg);
  }
  return { address, network: STELLAR_NETWORK };
}

export async function signTransaction(xdr: string, address: string) {
  return freighterSignTransaction(xdr, {
    address,
    // Reuse the shared mapping so signing and checkNetworkMismatch can't drift (#357).
    networkPassphrase: NETWORK_PASSPHRASES[STELLAR_NETWORK],
  });
}

/**
 * Sign a server-issued ownership challenge with Freighter (#32).
 *
 * This is message signing, not transaction signing: nothing is submitted to
 * the network and no funds can move. Replay protection comes from the nonce
 * and domain the backend embeds in `message`, which the caller must not
 * construct itself.
 *
 * Resolves to the signature as base64. Throws if the user rejects the
 * request or the signer isn't the address being proven.
 */
export async function signOwnershipMessage(
  message: string,
  address: string,
): Promise<string> {
  const result = await freighterSignMessage(message, {
    address,
    networkPassphrase: NETWORK_PASSPHRASES[STELLAR_NETWORK],
  });
  if (result.error || !result.signedMessage) {
    throw new Error(
      result.error?.message ?? "Wallet did not sign the ownership message.",
    );
  }
  if (result.signerAddress && result.signerAddress !== address) {
    throw new Error("The signing wallet doesn't match the address being linked.");
  }
  const signed = result.signedMessage;
  if (typeof signed === "string") return signed;
  let binary = "";
  for (const byte of signed as Uint8Array) binary += String.fromCharCode(byte);
  return btoa(binary);
}
