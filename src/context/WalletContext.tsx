"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  connectWallet as freighterConnect,
  getActiveFreighterAddress,
  checkNetworkMismatch,
  signOwnershipMessage,
} from "@/lib/wallet";
import { apiRequest } from "@/lib/api";
import { STELLAR_NETWORK } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { useCrossTabStorage } from "@/hooks/useCrossTabStorage";

const WALLET_KEY = "mergefi_wallet_address";

/**
 * Durability of the current wallet connection.
 *
 * `local` alone was never enough to call a connection "done". Freighter
 * access is a browser-local permission grant; the payout address that
 * actually matters is the one on the MergeFi profile
 * (`AuthUser.stellarAddress`), written by a server-side PATCH. A visitor who
 * connects a wallet before signing in gets `local` and nothing else — and
 * previously the UI showed them an identical green "Connected" banner, so
 * they had no way to tell that payouts could never reach that address (#456).
 */
export type WalletLinkState = "none" | "local" | "linked";

interface WalletContextValue {
  address: string | null;
  network: string | null;
  connecting: boolean;
  error: string | null;
  /**
   * `true` until the cached address has been read out of localStorage.
   *
   * Previously indistinguishable from "not connected": on first paint
   * `address` was `null`, so the Connect CTA rendered, and a click inside the
   * `setTimeout(0)` window re-prompted Freighter for a wallet that was
   * already cached (#456).
   */
  initializing: boolean;
  /** True when Freighter's active account differs from the cached address. */
  addressMismatch: boolean;
  /** True when Freighter's network doesn't match the app's configured network. */
  networkMismatch: boolean;
  /**
   * Re-run the Freighter network check and store the result, resolving to
   * whether there is *still* a mismatch.
   *
   * `networkMismatch` set on mount is a snapshot of one moment. The user can
   * switch networks inside the extension at any time afterwards — in either
   * direction — and nothing re-derives the flag until a full page reload, so
   * a stale `true` blocked every fund/claim/refund/deposit for the rest of
   * the session even after the problem was fixed, and a stale `false` let a
   * late switch go unchecked. Callers that are about to do something
   * consequential ask for a fresh answer here instead of trusting the cached
   * one.
   */
  recheckNetworkMismatch: () => Promise<boolean>;
  /** How durable the current connection is. See {@link WalletLinkState}. */
  linkState: WalletLinkState;
  /**
   * Set when Freighter's account differs from the address already linked to
   * the profile. Nothing is re-linked (or even adopted locally) until the
   * user calls `confirmRelink()`; `cancelRelink()` discards it (#32).
   */
  pendingRelinkAddress: string | null;
  confirmRelink: () => Promise<string | null>;
  cancelRelink: () => void;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  /**
   * Synchronously reads the error connect() most recently set, bypassing
   * React's render/commit timing. A caller that awaits connect() and gets
   * null back can't rely on the `error` field above for the reason why —
   * that's a value from whatever render created the closure, not
   * necessarily updated yet by the time the awaited call resolves. This
   * reads a ref updated in lockstep with every setError() call, so it's
   * always current the instant connect()'s promise settles (#235).
   */
  getError: () => string | null;
}

/** Challenge issued by `POST /users/:id/stellar-address/challenge`. */
interface OwnershipChallenge {
  /** Exact text to sign. Server-built: embeds domain, address, nonce, expiry. */
  message: string;
  nonce: string;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user, refresh, loading: authLoading } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressMismatch, setAddressMismatch] = useState(false);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [pendingRelinkAddress, setPendingRelinkAddress] = useState<
    string | null
  >(null);
  const errorRef = useRef<string | null>(null);
  const updateError = useCallback((message: string | null) => {
    errorRef.current = message;
    setError(message);
  }, []);
  const getError = useCallback(() => errorRef.current, []);

  const recheckNetworkMismatch = useCallback(async (): Promise<boolean> => {
    const msg = await checkNetworkMismatch();
    setNetworkMismatch(!!msg);
    return !!msg;
  }, []);

  useEffect(() => {
    // localStorage is unavailable during SSR, so this can't be a lazy
    // useState initializer — it must run after mount on the client.
    // Deferred by a tick (#223), same as AuthProvider's mount hydration,
    // so this provider (mounted on every route) doesn't add to the
    // critical path to interactivity for routes that don't need it yet.
    const id = window.setTimeout(() => {
      const stored = window.localStorage.getItem(WALLET_KEY);
      if (stored) {
        setAddress(stored);
        // This app only ever signs against the build's configured network,
        // so a restored address always comes with that network (#228) —
        // no need to persist a separate network key.
        setNetwork(STELLAR_NETWORK);

        // Reconcile the cached address against Freighter's actual active
        // account. If the user switched accounts inside the extension
        // without touching MergeFi, the cached address is stale (#71).
        getActiveFreighterAddress().then((live) => {
          if (live && live !== stored) {
            setAddressMismatch(true);
          }
        });

        // Also verify the extension's network matches the app's (#2).
        void recheckNetworkMismatch();
      }
      // Always clear `initializing`, including the no-stored-address path —
      // otherwise a first-time visitor is stuck on a pending state forever.
      setInitializing(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [recheckNetworkMismatch]);

  const handleWalletKeyChangedElsewhere = useCallback(
    (newValue: string | null) => {
      setAddress(newValue);
      // An address adopted from another tab belongs to the same configured
      // network as one restored on mount (#228) — previously `network` was
      // only set on the null branch, so an adopted address rendered as
      // "Connected: GABC…WXYZ ()" (#456).
      setNetwork(newValue ? STELLAR_NETWORK : null);
      // The cached address just changed underneath us, so any mismatch we
      // previously recorded no longer describes reality. Re-derive on next
      // connect() rather than leaving a stale block in place forever.
      if (newValue !== null) {
        setAddressMismatch(false);
        setNetworkMismatch(false);
      }
    },
    [],
  );
  useCrossTabStorage(WALLET_KEY, handleWalletKeyChangedElsewhere);

  // Tracks the latest `address` for the logout-clearing effect below
  // without making that effect depend on (and therefore re-run on) every
  // address change — only an actual `user` transition should trigger a
  // clear. Kept current after every render rather than read via a
  // `setAddress(prev => ...)` functional updater, which is exactly the
  // "peek at previous state inside an effect" shape
  // react-hooks/set-state-in-effect flags.
  const addressRef = useRef(address);
  useEffect(() => {
    addressRef.current = address;
  });

  // #270: When AuthContext logs the user out (cross-tab or otherwise),
  // clear the wallet connection too so a stale address is never usable
  // in a tab where the session has ended.
  //
  // Gated on `authLoading` as well as `user`. Previously the effect's only dep
  // was `user`, and `user` starts (and can stay) `null` on a cold load — so
  // a visitor arriving with a cached wallet address and no valid session never
  // transitioned `user` and this effect never ran, leaving a usable address
  // behind. `useWalletAction` would then fund a bounty against that stale
  // address with no `connect()` call and no PATCH (#456). Waiting for the auth
  // resolution to finish makes the transition observable.
  useEffect(() => {
    if (authLoading) return;
    if (user === null && addressRef.current !== null) {
      window.localStorage.removeItem(WALLET_KEY);
      setNetwork(null);
      setAddress(null);
      setAddressMismatch(false);
      setNetworkMismatch(false);
    }
  }, [user, authLoading]);

  // #32: `AuthUser.stellarAddress` is the backend's source of truth for the
  // payout wallet. A localStorage value written in an earlier session — or
  // from another device that has since linked something else — must not be
  // shown as "connected" once the profile says otherwise, so the profile
  // address overwrites the cache whenever they disagree. A profile with no
  // address leaves a cached one alone: that's the honest "local" state.
  useEffect(() => {
    if (authLoading || !user?.stellarAddress) return;
    const onFile = user.stellarAddress;
    if (addressRef.current === onFile) return;
    try {
      window.localStorage.setItem(WALLET_KEY, onFile);
    } catch {
      // Private-mode storage failure: in-memory state below still corrects.
    }
    setAddress(onFile);
    setNetwork(STELLAR_NETWORK);
    setAddressMismatch(false);
  }, [user?.stellarAddress, authLoading]);

  /**
   * Link `walletAddress` to the profile, gated on a signed proof of
   * ownership (#32). The backend issues a nonce-bearing challenge; Freighter
   * signs it; the PATCH carries the signature for server-side verification.
   * Never sends a bare address.
   */
  const linkWithProof = useCallback(
    async (userId: string, walletAddress: string) => {
      const challenge = await apiRequest<OwnershipChallenge>(
        `/users/${userId}/stellar-address/challenge`,
        {
          method: "POST",
          body: JSON.stringify({ stellarAddress: walletAddress }),
        },
      );
      const signature = await signOwnershipMessage(
        challenge.message,
        walletAddress,
      );
      await apiRequest(`/users/${userId}/stellar-address`, {
        method: "PATCH",
        body: JSON.stringify({
          stellarAddress: walletAddress,
          nonce: challenge.nonce,
          message: challenge.message,
          signature,
        }),
      });
      await refresh();
    },
    [refresh],
  );

  const adoptAndLink = useCallback(
    async (walletAddress: string) => {
      setAddress(walletAddress);
      setNetwork(STELLAR_NETWORK);
      setAddressMismatch(false);
      setNetworkMismatch(false);
      window.localStorage.setItem(WALLET_KEY, walletAddress);

      if (user) {
        try {
          await linkWithProof(user.id, walletAddress);
        } catch (err) {
          // The wallet is still usable for signing this session even if the
          // link failed, but the user needs to know their payout wallet
          // wasn't actually saved to their profile (#229). Leaving
          // `linkState` at "local" is what makes that visible — the Connect
          // CTA stays available so they can retry the link.
          updateError(
            err instanceof Error && /reject|declin|denied/i.test(err.message)
              ? "Wallet connected, but you didn't sign the ownership proof, so it wasn't linked to your profile."
              : "Wallet connected, but couldn't save it to your profile — try reconnecting.",
          );
        }
      }
      return walletAddress;
    },
    [user, linkWithProof, updateError],
  );

  const connect = useCallback(async () => {
    updateError(null);
    setPendingRelinkAddress(null);
    setConnecting(true);
    try {
      const connection = await freighterConnect();
      // A different account than the one on file must never silently replace
      // the payout wallet (#32). Hold it as pending and let the UI ask.
      if (
        user?.stellarAddress &&
        user.stellarAddress !== connection.address
      ) {
        setPendingRelinkAddress(connection.address);
        return null;
      }
      return await adoptAndLink(connection.address);
    } catch (err) {
      // connectWallet() (lib/wallet.ts) already throws a real Error with a
      // specific, actionable message for every failure path it detects —
      // including "not installed" via isFreighterInstalled() — so there's
      // no distinct "not an Error" case that means "extension missing" to
      // special-case here (#192). The non-Error fallback below only covers
      // a genuinely unexpected non-Error throw.
      updateError(
        err instanceof Error
          ? err.message
          : "Unable to connect wallet. Please try again.",
      );
      return null;
    } finally {
      setConnecting(false);
    }
  }, [user, adoptAndLink, updateError]);

  const confirmRelink = useCallback(async () => {
    if (!pendingRelinkAddress) return null;
    updateError(null);
    setConnecting(true);
    try {
      const target = pendingRelinkAddress;
      setPendingRelinkAddress(null);
      return await adoptAndLink(target);
    } finally {
      setConnecting(false);
    }
  }, [pendingRelinkAddress, adoptAndLink, updateError]);

  const cancelRelink = useCallback(() => setPendingRelinkAddress(null), []);

  const disconnect = useCallback(() => {
    // Best-effort local clear: localStorage throws in Safari private browsing.
    try {
      window.localStorage.removeItem(WALLET_KEY);
    } catch {
      // Ignore — the in-memory state below is what the UI renders from.
    }
    setAddress(null);
    setNetwork(null);
    setPendingRelinkAddress(null);
    // Clear the mismatch flags too. They used to survive a disconnect, and
    // `useWalletAction` blocks on them — so "disconnect and reconnect" left
    // the user in a loop that the UI gave them no way out of (#456).
    setAddressMismatch(false);
    setNetworkMismatch(false);
    // Clear a stale connect() error. Otherwise a failed connect followed by a
    // disconnect left the error paragraph on /connect permanently, since the
    // only reset lived inside connect().
    updateError(null);
    if (user) {
      // Best-effort unlink, mirroring connect()'s PATCH — the local
      // disconnect (clearing UI/localStorage state) already succeeded
      // synchronously above regardless of whether this call does, so a
      // signed-in user's "disconnected" UI never lies about local state.
      // If this fails, AuthUser.stellarAddress on the backend still holds
      // the old address until the user connects again (#230).
      apiRequest(`/users/${user.id}/stellar-address`, {
        method: "PATCH",
        body: JSON.stringify({ stellarAddress: null }),
      })
        .then(() => {
          void refresh();
        })
        .catch(() => {});
    }
  }, [user, refresh, updateError]);

  const linkState = useMemo<WalletLinkState>(() => {
    if (!address) return "none";
    // "linked" means the address that will receive payouts is server-side
    // confirmed as this one. A mismatch with the on-file address is *not*
    // linked — payouts still go to the old address, so presenting it as
    // complete would be the exact lie this state exists to prevent.
    if (user && user.stellarAddress === address) return "linked";
    return "local";
  }, [address, user]);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      network,
      connecting,
      error,
      initializing,
      addressMismatch,
      networkMismatch,
      recheckNetworkMismatch,
      linkState,
      pendingRelinkAddress,
      confirmRelink,
      cancelRelink,
      connect,
      disconnect,
      getError,
    }),
    [
      address,
      network,
      connecting,
      error,
      initializing,
      addressMismatch,
      networkMismatch,
      recheckNetworkMismatch,
      linkState,
      pendingRelinkAddress,
      confirmRelink,
      cancelRelink,
      connect,
      disconnect,
      getError,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
