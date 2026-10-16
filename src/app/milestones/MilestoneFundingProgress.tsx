import { formatCurrency, formatPercent } from "@/lib/utils";

export function MilestoneFundingProgress({
  budget,
  distributed,
  asset,
}: {
  budget: number;
  distributed: number;
  asset: "USDC" | "XLM";
}) {
  const isUnfunded = budget <= 0;
  const rawPct = isUnfunded ? 0 : distributed / budget;
  const pct = Math.min(rawPct, 1);

  return (
    <>
      <div
        role="progressbar"
        aria-label="Milestone funding progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct * 100}
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          aria-hidden="true"
          className="h-full bg-indigo-600"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          {formatCurrency(distributed, asset)} of{" "}
          {formatCurrency(budget, asset)}
        </span>
        <span>
          {isUnfunded
            ? "Not yet funded"
            : rawPct > 1
              ? "Over-funded"
              : formatPercent(rawPct)}
        </span>
      </div>
    </>
  );
}
