"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useWalletAction } from "@/hooks/useWalletAction";
import { apiPost, ApiRequestError } from "@/lib/api";
import { formatCurrency, generateIdempotencyKey } from "@/lib/utils";
import type { Bounty } from "@/types";

export function IssueActions({ bounty }: { bounty: Bounty }) {
  const router = useRouter();
  const { user } = useAuth();
  const { runWithWallet, connecting } = useWalletAction();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function handleClaim() {
    setError(null);
    setNotice(null);
    if (!user) {
      router.push("/connect");
      return;
    }
    setPending(true);
    try {
      await apiPost(`/bounties/${bounty.id}/claim`, {
        contributorId: user.id,
        idempotencyKey: generateIdempotencyKey(),
      });
      setNotice("You've claimed this issue. Open a pull request to get started.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

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
        {bounty.status === "open" && (
          <Button size="lg" onClick={handleFund} loading={pending || connecting}>
            {pending || connecting ? "Confirming in wallet..." : "Fund this bounty"}
          </Button>
        )}
        {bounty.status === "funded" && (
          <Button size="lg" onClick={handleClaim} loading={pending}>
            {pending ? "Claiming..." : "Claim this issue"}
          </Button>
        )}
        {(bounty.status === "funded" || bounty.status === "claimed") && (
          <Button size="lg" variant="outline" onClick={handleRefund} loading={pending}>
            Refund sponsor
          </Button>
        )}
        {["in_review", "merged", "paid", "refunded", "expired"].includes(
          bounty.status,
        ) && (
          <Button size="lg" variant="outline" disabled>
            {bounty.status === "paid"
              ? "Payout complete"
              : bounty.status === "in_review"
                ? "Awaiting PR merge"
                : bounty.status === "merged"
                  ? "Payout pending"
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
