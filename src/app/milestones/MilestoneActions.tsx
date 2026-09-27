"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useWalletAction } from "@/hooks/useWalletAction";
import { apiPost, ApiRequestError } from "@/lib/api";
import {
  parseMoneyInput,
  generateIdempotencyKey,
  formatCurrency,
} from "@/lib/utils";

/**
 * parseMoneyInput is the single source of truth for "is this a usable amount"
 * (non-empty, finite, > 0, within the asset's decimal precision) — reused
 * here rather than reimplementing validation for the milestone form, so the
 * two funding inputs on this page can't drift apart.
 *
 * `max`, when the caller knows the milestone's remaining budget, additionally
 * rejects amounts that would overfund it. That cap is deliberately client-side
 * and advisory: the backend remains authoritative, and an unknown budget (a
 * milestone with budget <= 0) simply skips the check rather than blocking
 * funding outright.
 */
function validateFundingAmount(
  raw: string,
  asset: "USDC" | "XLM",
  max?: number,
): { valid: boolean; normalized?: string; error?: string } {
  const result = parseMoneyInput(raw, asset);
  if (!result.valid) return result;
  if (max !== undefined && Number(result.normalized) > max) {
    return {
      valid: false,
      error: `Amount exceeds the remaining ${formatCurrency(max, asset)} budget.`,
    };
  }
  return result;
}

/** Pre-fill the remaining budget, rounded down to the asset's precision. */
function defaultAmount(asset: "USDC" | "XLM", remainingBudget?: number): string {
  if (remainingBudget === undefined || !Number.isFinite(remainingBudget)) return "100";
  if (remainingBudget <= 0) return "100";
  return remainingBudget.toFixed(asset === "XLM" ? 7 : 2).replace(/\.?0+$/, "") || "0";
}

export function MilestoneFundButton({
  milestoneId,
  milestoneName,
  remainingBudget,
  asset = "USDC",
}: {
  milestoneId: string;
  milestoneName?: string;
  /** budget - distributed, when the caller knows it. Undefined = no cap. */
  remainingBudget?: number;
  asset?: "USDC" | "XLM";
}) {
  const router = useRouter();
  const { runWithWallet, connecting } = useWalletAction();
  const [amount, setAmount] = useState(() => defaultAmount(asset, remainingBudget));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const validation = validateFundingAmount(amount, asset, remainingBudget);
  const inputValid = validation.valid;

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmount(e.target.value);
    setError(null);
    setNotice(null);
  }

  async function handleFund() {
    setError(null);
    setNotice(null);
    // Re-validate at submit time in case state drifted
    const result = validateFundingAmount(amount, asset, remainingBudget);
    if (!result.valid) {
      setError(result.error ?? "Invalid amount.");
      return;
    }

    setPending(true);
    try {
      const walletResult = await runWithWallet(
        (walletAddress) =>
          apiPost(`/milestones/${milestoneId}/fund`, {
            // The amount is a string, matching the backend's own money-amount
            // convention (`@IsMoneyAmount() amount: string` in
            // mergefi-backend's create-bounty DTO) and PoolDepositButton's
            // deposit call — never a JS float.
            amount: result.normalized,
            funderAddress: walletAddress,
            idempotencyKey: generateIdempotencyKey(),
          }),
        "Connect a Stellar wallet to fund this milestone.",
      );
      if (!walletResult.ok) {
        setError(walletResult.error);
        return;
      }
      setNotice(
        "Milestone funded successfully. The funds are now locked in escrow.",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Something went wrong.",
      );
    } finally {
      setPending(false);
    }
  }

  const step = asset === "XLM" ? "0.0000001" : "0.01";
  const inputId = `milestone-fund-${milestoneId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const hasHint = remainingBudget !== undefined;
  const describedBy =
    [hasHint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="mt-4 flex items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Funding amount
      </label>
      {hasHint && (
        <p id={hintId} className="sr-only">
          Remaining budget: {formatCurrency(remainingBudget, asset)}.
        </p>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        type="number"
        min={step}
        step={step}
        max={remainingBudget}
        value={amount}
        onChange={handleAmountChange}
        className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleFund}
        loading={pending || connecting}
        disabled={!inputValid}
        aria-label={
          milestoneName ? `Fund milestone: ${milestoneName}` : "Fund milestone"
        }
      >
        {pending || connecting ? "Confirming in wallet..." : "Fund milestone"}
      </Button>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-xs text-emerald-600"
        >
          {notice}
        </p>
      )}
    </div>
  );
}

export function PoolDepositButton({
  poolId,
  poolRepo,
  asset = "USDC",
}: {
  poolId: string;
  poolRepo?: string;
  asset?: "USDC" | "XLM";
}) {
  const router = useRouter();
  const { runWithWallet, connecting } = useWalletAction();
  const [amount, setAmount] = useState("100");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validation = parseMoneyInput(amount, asset);
  const inputValid = validation.valid;

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmount(e.target.value);
    setError(null);
    setSuccess(false);
  }

  async function handleDeposit() {
    setError(null);
    setSuccess(false);
    // Re-validate at submit time in case state drifted
    const result = parseMoneyInput(amount, asset);
    if (!result.valid) {
      setError(result.error ?? "Invalid amount.");
      return;
    }

    setPending(true);
    try {
      const walletResult = await runWithWallet(
        (walletAddress) =>
          apiPost(`/maintenance-pools/${poolId}/deposit`, {
            amount: result.normalized,
            funderAddress: walletAddress,
            idempotencyKey: generateIdempotencyKey(),
          }),
        "Connect a Stellar wallet to deposit.",
      );
      if (!walletResult.ok) {
        setError(walletResult.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Something went wrong.",
      );
    } finally {
      setPending(false);
    }
  }

  const step = asset === "XLM" ? "0.0000001" : "0.01";
  const inputId = `pool-deposit-${poolId}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="mt-4 flex items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Deposit amount
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        type="number"
        min={step}
        step={step}
        value={amount}
        onChange={handleAmountChange}
        className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleDeposit}
        loading={pending || connecting}
        disabled={!inputValid}
        aria-label={
          poolRepo ? `Deposit to pool: ${poolRepo}` : "Deposit to pool"
        }
      >
        {pending || connecting ? "Confirming..." : "Deposit"}
      </Button>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-emerald-600"
        >
          Deposit successful.
        </p>
      )}
    </div>
  );
}
