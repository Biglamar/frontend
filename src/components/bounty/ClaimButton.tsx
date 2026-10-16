'use client';

import React, { useEffect, useRef, useReducer } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClaimRace } from '@/hooks/useClaimRace';
import { useBountyStatus } from '@/hooks/useBountyStatus';
import { useAuth } from '@/context/AuthContext';
import type { Bounty } from '@/types/bounty';

interface ClaimButtonProps {
  bountyId: string;
  fallbackBounty?: Bounty;
  onClaimSuccess?: () => void;
  className?: string;
}

type ClaimState = {
  showRaceMessage: boolean;
  claimSuccess: boolean;
};

type ClaimAction = 
  | { type: 'SHOW_RACE_MESSAGE' }
  | { type: 'HIDE_RACE_MESSAGE' }
  | { type: 'SHOW_CLAIM_SUCCESS' }
  | { type: 'HIDE_CLAIM_SUCCESS' }
  | { type: 'RESET' };

const initialState: ClaimState = {
  showRaceMessage: false,
  claimSuccess: false,
};

function claimReducer(state: ClaimState, action: ClaimAction): ClaimState {
  switch (action.type) {
    case 'SHOW_RACE_MESSAGE':
      return { ...state, showRaceMessage: true };
    case 'HIDE_RACE_MESSAGE':
      return { ...state, showRaceMessage: false };
    case 'SHOW_CLAIM_SUCCESS':
      return { ...state, claimSuccess: true };
    case 'HIDE_CLAIM_SUCCESS':
      return { ...state, claimSuccess: false };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function ClaimButton({ 
  bountyId, 
  fallbackBounty,
  onClaimSuccess, 
  className = '' 
}: ClaimButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { claim, isClaiming, lastResult, reset } = useClaimRace(bountyId);
  const { bounty, refetch, status, isPolling } = useBountyStatus({
    bountyId,
    fallbackBounty,
    interval: 2000,
  });

  const [state, dispatch] = useReducer(claimReducer, initialState);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // The handlers this effect needs are not identity-stable:
  // `onClaimSuccess` is an inline callback owned by the parent, and
  // `refetch` comes from `useBountyStatus`, which rebuilds its `fetchFn` /
  // `compareFn` / `onDataChange` inline on every render. Depending on any of
  // them re-ran the whole result branch on every parent render — a duplicate
  // refetch, a duplicate `router.refresh()`, and a restarted auto-dismiss
  // countdown that could keep the success panel up indefinitely. Read them
  // through a ref so the effect fires exactly once per distinct `lastResult`.
  const callbacksRef = useRef({ refetch, reset, onClaimSuccess });
  useEffect(() => {
    callbacksRef.current = { refetch, reset, onClaimSuccess };
  });

  // Handle result changes
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const { refetch: doRefetch, reset: doReset, onClaimSuccess: notify } =
      callbacksRef.current;

    if (lastResult?.success === false && lastResult.error === 'ALREADY_CLAIMED') {
      dispatch({ type: 'SHOW_RACE_MESSAGE' });
      doRefetch();
      timerRef.current = setTimeout(() => {
        dispatch({ type: 'HIDE_RACE_MESSAGE' });
        doReset();
      }, 15000);
    } else if (lastResult?.success === true) {
      dispatch({ type: 'SHOW_CLAIM_SUCCESS' });
      doRefetch();
      notify?.();
      timerRef.current = setTimeout(() => {
        dispatch({ type: 'HIDE_CLAIM_SUCCESS' });
        doReset();
      }, 5000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [lastResult]);

  const handleClaim = async () => {
    // Same gate the pre-ClaimButton handleClaim had: claiming is an
    // authenticated action (POST /bounties/:id/claim takes the contributor
    // from the JWT), so a signed-out click goes to /connect rather than
    // firing a request that can only 401.
    if (!user) {
      router.push('/connect');
      return;
    }
    dispatch({ type: 'RESET' });
    reset();
    await claim();
  };

  /**
   * A claim failure that isn't the race we lost. `useClaimRace` records these
   * in `lastResult`, but nothing rendered them — the spinner stopped and the
   * page looked unchanged, which reads as success-with-no-effect. Rendered
   * here as a red panel with `role="alert"`, so it is unmistakably distinct
   * from the amber wallet prerequisite above and from the in-flight spinner.
   *
   * Stays until the next claim attempt (`handleClaim` resets) rather than
   * auto-dismissing: an error that vanishes on its own is one the user can
   * easily miss.
   */
  const claimErrorMessage =
    lastResult?.success === false && lastResult.error !== 'ALREADY_CLAIMED'
      ? (lastResult.message ?? 'Something went wrong.')
      : null;

  const isDisabled = isClaiming || status === 'claimed';

  /**
   * Signed in, but no payout address on file — block the claim outright.
   *
   * DECISION: hard block, not a soft warning. MergeFi releases escrow
   * automatically when a PR merges (README: "no manual approval step"), so a
   * wallet-less claim is a dead end the contributor only discovers after the
   * work is done. mergefi-backend *intends* to reject it as well —
   * `BountiesService.claim()` throws
   * `BadRequestException('... has no linked Stellar address')` — but that
   * method currently references an undefined `contributorId` on main
   * (MergeFi/backend@9c78fd91e, left over from a partial auth-binding
   * refactor), so the server-side guard cannot be relied on today. Blocking
   * here is both the reliable check and the last point where the fix is
   * cheap for the user.
   *
   * Checked against `user.stellarAddress` (the durable, server-linked payout
   * address) rather than Freighter's live session: having the extension open
   * right now is not the same as having an address on file that the webhook
   * release can pay, and requiring the former would block claims from users
   * whose linked wallet is perfectly fine.
   *
   * Distinct from the pending state (spinner inside a disabled button) and
   * from the red race/error panels: this is an amber prerequisite notice with
   * a forward link, so it reads as "do this first", not "this failed".
   *
   * TEAM SPLITS (audited, not fixed here): a team bounty pays each
   * `TeamMemberSplit` via `escrowService.splitRelease`, which reads each
   * member's address as `user?.stellarAddress ?? ''` — with no check that
   * the address is non-empty. A split recipient with no linked wallet
   * therefore produces an empty `recipientAddress` and fails at release
   * time, after the work is merged. Neither `TeamSplit` nor the team-split
   * UI carries any wallet state today, so there is nothing to gate at claim
   * time on this side; the check belongs in mergefi-backend's split-release
   * path (and arguably a per-member prerequisite on team creation).
   */
  const needsPayoutWallet = !!user && !user.stellarAddress;

  if (status === 'claimed') {
    return (
      <div className={`p-4 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <p className="text-gray-600">
          This bounty has already been <span className="font-medium">{status}</span>
        </p>
        {bounty?.claimedBy && (
          <p className="text-sm text-gray-500 mt-1">
            Claimed by: {bounty.claimedBy}
          </p>
        )}
      </div>
    );
  }

  if (needsPayoutWallet) {
    return (
      <div
        className={`p-4 bg-amber-50 border border-amber-200 rounded-lg ${className}`}
        role="status"
        aria-live="polite"
      >
        <h4 className="text-amber-800 font-semibold">
          Add a payout wallet to claim this bounty
        </h4>
        <p className="text-amber-700 text-sm mt-1">
          Merging your pull request releases the reward automatically, so a
          Stellar wallet needs to be linked to your account first. Yours
          isn&apos;t linked yet.
        </p>
        <Link
          href="/connect"
          className="mt-3 inline-flex items-center rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
        >
          Connect a wallet
        </Link>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {state.showRaceMessage && lastResult?.success === false && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏃</span>
            <div>
              <h4 className="text-red-700 font-semibold">
                Someone else claimed this bounty first!
              </h4>
              <p className="text-red-600 text-sm mt-1">
                The bounty has been claimed by another contributor. 
                The status has been updated below.
              </p>
              <button 
                onClick={() => dispatch({ type: 'HIDE_RACE_MESSAGE' })}
                className="mt-2 text-sm text-red-500 hover:text-red-700 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {state.claimSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h4 className="text-green-700 font-semibold">Successfully claimed!</h4>
              <p className="text-green-600 text-sm mt-1">
                You have claimed this bounty. Good luck!
              </p>
            </div>
          </div>
        </div>
      )}

      {claimErrorMessage && (
        <div
          className="p-4 bg-red-50 border border-red-200 rounded-lg"
          role="alert"
        >
          <p className="text-red-700 font-semibold">Couldn&apos;t claim this bounty</p>
          <p className="text-red-600 text-sm mt-1">{claimErrorMessage}</p>
        </div>
      )}

      <button
        onClick={handleClaim}
        disabled={isDisabled}
        className={`
          w-full py-3 px-4 rounded-lg font-semibold transition-all
          ${isDisabled 
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'}
        `}
      >
        {isClaiming ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing claim...
          </span>
        ) : (
          'Claim Bounty'
        )}
      </button>

      {isPolling && (
        <p className="text-xs text-gray-400 text-center">
          🔄 Auto-refreshing status...
        </p>
      )}
    </div>
  );
}
