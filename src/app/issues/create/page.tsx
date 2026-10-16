"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiPost } from "@/lib/api";
import { parseMoneyInput, generateIdempotencyKey } from "@/lib/utils";

const ASSETS = ["USDC", "XLM"] as const;
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export default function CreateBountyPage() {
  const router = useRouter();
  const [issue, setIssue] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("USDC");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("beginner");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = parseMoneyInput(amount, asset);
    if (!validation.ok) {
      setError(validation.error ?? "Invalid amount");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/bounties", {
        issue,
        amount: validation.amount,
        asset,
        difficulty,
        deadline: deadline || undefined,
      }, generateIdempotencyKey());
      router.push("/issues");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bounty");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
        Create bounty
      </h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">
        Pick a synced GitHub issue, set the reward, and fund it from your wallet.
      </p>

      <Card className="mt-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="issue" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              GitHub issue
            </label>
            <input
              id="issue"
              type="text"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="owner/repo#123"
              required
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Amount
              </label>
              <input
                id="amount"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                required
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="asset" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Asset
              </label>
              <select
                id="asset"
                value={asset}
                onChange={(e) => setAsset(e.target.value as typeof ASSETS[number])}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {ASSETS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="difficulty" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Difficulty
              </label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as typeof DIFFICULTIES[number])}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="deadline" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Deadline (optional)
              </label>
              <input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create bounty"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
