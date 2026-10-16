"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useWalletAction } from "@/hooks/useWalletAction";
import { apiPost, ApiRequestError } from "@/lib/api";
import { formatCurrency, generateIdempotencyKey } from "@/lib/utils";
import { ClaimButton } from "@/components/bounty/ClaimButton";
import type { Bounty } from "@/types";

export function IssueActions({ bounty }: { bounty: Bounty }) {
  const router = useRouter();
  const { user } = useAuth();
  const { runWithWallet, connecting } = useWalletAction();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Whether the signed-in user is this bounty's sponsor, i.e. the account
   * whose money the escrow holds.
   *
   * Fail closed on every missing half: signed out, or a bounty with no
   * `sponsorId` (mock data, or a backend response predating the column) —
   * in neither case can we demonstrate the viewer is the funder, and the
   * refund button must not be offered on an assumption.
   *
   * Not a *security* boundary — mergefi-backend independently enforces
   * `bounty.sponsorId === callerUserId` inside `BountiesService.refund()`
   * (ForbiddenException → 403; see the note on `handleRefund` below). This
   * exists so the UI stops advertising a destructive action to every visitor
   * who can read the page.
   */
  const isSponsor = !!user && !!bounty.sponsorId && user.id === bounty.sponsorId;

  /**
   * "Fund this bounty" is sponsor-only, same as "Refund sponsor" (#602).
   *
   * mergefi-backend's `POST /bounties/:id/fund` throws 403
   * "Only the bounty sponsor can fund this bounty" unless
   * `bounty.sponsorId === callerUserId`. Offering the button to every visitor
   * invited contributors to connect a wallet and then hit that error.
   * Non-sponsors now see a neutral "Awaiting sponsor funding" state instead.
   */
  // SCOPED OUT (deliberate, not overlooked): bounty.teamSplitsValid is now
  // surfaced as a visible warning on IssueDetailPage, but it does *not* gate
  // "Claim this issue" or "Fund this bounty" here. Claiming is a
  // server-authoritative action — the backend re-validates the split before
  // any payout is released, so client-side gating here would only add a dead
  // end: a contributor blocked from claiming because of a split they don't
  // control (the sponsor/maintainer sets it) would have no way to resolve it.
  // A blocked action with no recovery path is worse than a visible warning.
  // If split integrity ever needs to be enforced at claim time, it belongs in
  // the backend's claim/payout validation, surfaced as an error on the POST —
  // not as a client-side disabled button.

  async function handleFund() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const result = await runWithWallet(async (walletAddress) => {
        await apiPost(`/bounties/${bounty.id}/fund`, {
          funderAddress: walletAddress,
          idempotencyKey: generateIdempotencyKey(),
        });
        setNotice("Escrow funded on-chain. This bounty is now open for claims.");
      }, "Connect a Stellar wallet to continue.");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const handleClaimSuccess = () => {
    setNotice("You've claimed this issue. Open a pull request to get started.");
    router.refresh();
  };

  /**
   * Refund the escrowed bounty back to its sponsor.
   *
   * Note the request body carries no sponsor identity, and deliberately
   * shouldn't: mergefi-backend reads the caller from the JWT
   * (`req.user.userId`) and compares it to `bounty.sponsorId` itself, so a
   * client-supplied `funderId` would be ignored rather than trusted. The
   * identity check that matters therefore happens twice — server-side as a
   * hard 403, and in the render condition below so the button is never
   * offered to someone the server is going to reject.
   */
  async function handleRefund() {
    const confirmed = window.confirm(
      `Are you sure you want to refund this bounty? This will return ${formatCurrency(bounty.reward, bounty.asset)} to the sponsor and cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setNotice(null);
    setPending(true);
    try {
      await apiPost(`/bounties/${bounty.id}/refund`, {
        idempotencyKey: generateIdempotencyKey(),
      });
      setNotice("Escrowed funds were refunded to the sponsor.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-10">
      <div className="flex flex-wrap gap-3">
        {bounty.status === "open" && isSponsor && (
          <Button size="lg" onClick={handleFund} loading={pending || connecting}>
            {pending || connecting ? "Confirming in wallet..." : "Fund this bounty"}
          </Button>
        )}
        {bounty.status === "open" && !isSponsor && (
          <Button size="lg" variant="outline" disabled>
            Awaiting sponsor funding
          </Button>
        )}
        {bounty.status === "funded" && (
          <ClaimButton
            bountyId={bounty.id}
            fallbackBounty={bounty}
            onClaimSuccess={handleClaimSuccess}
          />
        )}
        {/*
          Sponsor-only. Rendered for nobody else — not for signed-out
          readers, not for a contributor browsing funded work, and not when
          the bounty carries no sponsorId to compare against. See isSponsor.
        */}
        {isSponsor && (bounty.status === "funded" || bounty.status === "claimed") && (
          <Button size="lg" variant="outline" onClick={handleRefund} loading={pending}>
            Refund sponsor
          </Button>
        )}
        {["in_review", "merged", "release_failed", "paid", "refunded", "expired", "unknown"].includes(
          bounty.status,
        ) && (
          <Button size="lg" variant="outline" disabled>
            {bounty.status === "paid"
              ? "Payout complete"
              : bounty.status === "in_review"
                ? "Awaiting PR merge"
                : bounty.status === "merged"
                  ? "Payout pending"
                  : bounty.status === "release_failed"
                    ? "Payout failed — contact support"
                    : "No action available"}
          </Button>
        )}
      </div>
      {notice && (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        Funding and claiming write to the live mergefi-backend API. Merge
        detection and payout release happen automatically via GitHub
        webhooks once a linked pull request is merged.
      </p>
    </div>
  );
}
