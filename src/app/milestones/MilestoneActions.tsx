"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/context/WalletContext";
import { apiPost, ApiRequestError } from "@/lib/api";

/** #592 — generate a UUID for the Idempotency-Key header. */
function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function MilestoneFundButton({ milestoneId }: { milestoneId: string }) {
  const router = useRouter();
  const { address, connect, connecting, getError: getWalletError } = useWallet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFund() {
    setError(null);
    setPending(true);
    try {
      const walletAddress = address ?? (await connect());
      if (!walletAddress) {
        setError(getWalletError() ?? "Connect a Stellar wallet to fund this milestone.");
        return;
      }
      // #594 — backend FundMilestoneDto only accepts funderAddress; no amount field.
      await apiPost(
        `/milestones/${milestoneId}/fund`,
        { funderAddress: walletAddress },
        generateIdempotencyKey(),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <Button size="sm" variant="outline" onClick={handleFund} loading={pending || connecting}>
        {pending || connecting ? "Confirming in wallet..." : "Fund milestone"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function PoolDepositButton({ poolId }: { poolId: string }) {
  const router = useRouter();
  const { address, connect, connecting, getError: getWalletError } = useWallet();
  const [amount, setAmount] = useState("100");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeposit() {
    setError(null);
    setPending(true);
    try {
      const walletAddress = address ?? (await connect());
      if (!walletAddress) {
        setError(getWalletError() ?? "Connect a Stellar wallet to deposit.");
        return;
      }
      await apiPost(
        `/maintenance-pools/${poolId}/deposit`,
        { amount, funderAddress: walletAddress },
        generateIdempotencyKey(),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const inputId = `pool-deposit-${poolId}`;

  return (
    <div className="mt-4 flex items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Deposit amount
      </label>
      <input
        id={inputId}
        type="number"
        min="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
      />
      <Button size="sm" variant="outline" onClick={handleDeposit} loading={pending || connecting}>
        {pending || connecting ? "Confirming..." : "Deposit"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
