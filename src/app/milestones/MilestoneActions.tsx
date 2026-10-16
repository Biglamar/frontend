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

// ── Milestone management (#638) ──────────────────────────────────────────────

/**
 * Button that opens a dialog to create a new milestone.
 */
export function CreateMilestoneButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate() {
    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/milestones", { name, repo }, generateIdempotencyKey());
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create milestone");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Create milestone
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Create milestone
            </h3>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo"
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Milestone name"
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>
            )}
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={submitting || !name || !repo}>
                {submitting ? "Creating…" : "Create"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Button that attaches a synced issue to a milestone.
 */
export function AttachIssueButton({ milestoneId }: { milestoneId: string }) {
  const [open, setOpen] = useState(false);
  const [issueId, setIssueId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAttach() {
    setError(null);
    setSubmitting(true);
    try {
      await apiPost(`/milestones/${milestoneId}/issues/${issueId}`, undefined, generateIdempotencyKey());
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach issue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Attach issue
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Attach issue to milestone
            </h3>
            <div className="mt-4">
              <input
                type="text"
                value={issueId}
                onChange={(e) => setIssueId(e.target.value)}
                placeholder="issue-id"
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>
            )}
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={handleAttach} disabled={submitting || !issueId}>
                {submitting ? "Attaching…" : "Attach"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Button that resolves a milestone issue and pays the contributor.
 */
export function ResolveIssueButton({
  milestoneId,
  issueId,
}: {
  milestoneId: string;
  issueId: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleResolve() {
    setError(null);
    setSubmitting(true);
    try {
      await apiPost(`/milestones/${milestoneId}/issues/${issueId}/resolve`, undefined, generateIdempotencyKey());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve issue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Button size="sm" variant="outline" onClick={handleResolve} disabled={submitting}>
        {submitting ? "Resolving…" : "Resolve & pay"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}
