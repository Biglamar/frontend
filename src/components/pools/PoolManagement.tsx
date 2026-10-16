"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { generateIdempotencyKey } from "@/lib/idempotency";

/**
 * Pool management components for creating maintenance pools and
 * assigning rewards from them (#639).
 */

export function CreatePoolButton({ org, repo }: { org?: string; repo?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [asset, setAsset] = useState<"USDC" | "XLM">("USDC");
  const [initialDeposit, setInitialDeposit] = useState("100");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Pool name is required.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await apiPost("/maintenance-pools", {
        name: name.trim(),
        asset,
        repo: org && repo ? `${org}/${repo}` : undefined,
        initialDeposit: parseFloat(initialDeposit) || 0,
        idempotencyKey: generateIdempotencyKey(),
      });
      setSuccess(true);
      setOpen(false);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pool.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Create pool
      </button>

      {open && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Create Maintenance Pool
          </h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Pool name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="e.g. Critical bug fixes"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Asset
              </label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value as "USDC" | "XLM")}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="USDC">USDC</option>
                <option value="XLM">XLM</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Initial deposit
              </label>
              <input
                type="number"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                min="0"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={pending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {pending ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          Pool created successfully!
        </p>
      )}
    </div>
  );
}

export function AssignRewardButton({
  poolId,
  bountyId,
  bountyTitle,
}: {
  poolId: string;
  bountyId: string;
  bountyTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("50");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleAssign() {
    setError(null);
    setPending(true);
    try {
      await apiPost(`/maintenance-pools/${poolId}/assign-reward`, {
        bountyId,
        amount: parseFloat(amount) || 0,
        idempotencyKey: generateIdempotencyKey(),
      });
      setSuccess(true);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign reward.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Assign reward
      </button>

      {open && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Assign Reward
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Bounty: {bountyTitle}
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                min="0"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleAssign}
                disabled={pending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {pending ? "Assigning..." : "Assign"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          Reward assigned successfully!
        </p>
      )}
    </div>
  );
}
