import type { Metadata } from "next";
import { fetchMilestones, fetchMaintenancePools } from "@/lib/api";
import { mockMilestones, mockMaintenancePools } from "@/lib/mock-data";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { MilestoneFundButton, PoolDepositButton } from "./MilestoneActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Target, Droplets } from "lucide-react";

const milestonesDescription =
  "Fund open source release milestones and recurring maintenance pools through MergeFi.";

export const metadata: Metadata = {
  title: "Milestones | MergeFi",
  description: milestonesDescription,
  openGraph: {
    title: "Milestones | MergeFi",
    description: milestonesDescription,
    url: "/milestones",
  },
  twitter: {
    card: "summary_large_image",
    title: "Milestones | MergeFi",
    description: milestonesDescription,
  },
};

export default async function MilestonesPage() {
  const [milestonesRes, poolsRes] = await Promise.all([
    fetchMilestones(mockMilestones),
    fetchMaintenancePools(mockMaintenancePools),
  ]);
  const milestones = milestonesRes.data;
  const pools = poolsRes.data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
        Funding
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
        Milestone funding
      </h1>
      <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
        Sponsors can fund an entire release instead of a single issue. Budget
        is distributed automatically across the milestone&apos;s issues as
        each one resolves.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-slate-900 dark:text-white">
        Active milestones
      </h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {milestones.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No milestones yet"
            description="Milestones will appear here once sponsors create them for open source releases."
          />
        ) : milestones.map((m) => {
          const isUnfunded = m.budget <= 0;
          const rawPct = isUnfunded ? 0 : m.distributed / m.budget;
          const pct = Math.min(rawPct, 1);
          return (
            <Card key={m.id}>
              <p className="text-xs text-slate-500 dark:text-slate-400">{m.repo}</p>
              <h3 className="mt-1 font-medium text-slate-900 dark:text-white">{m.name}</h3>
              <div className="mt-4" role="progressbar" aria-label="Payout progress" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-indigo-600"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>
                  {formatCurrency(m.distributed, m.asset)} of{" "}
                  {formatCurrency(m.budget, m.asset)} paid
                </span>
                <span>
                  {isUnfunded
                    ? "Not yet funded"
                    : rawPct > 1
                    ? "Over-funded"
                    : formatPercent(rawPct)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {m.completedCount} of {m.issueCount} issues complete
              </p>
              <MilestoneFundButton milestoneId={m.id} milestoneName={m.name} />
            </Card>
          );
        })}
      </div>

      <h2 className="mt-16 text-2xl font-semibold text-slate-900 dark:text-white">
        Recurring maintenance pools
      </h2>
      <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
        Sponsors deposit monthly so maintainers can reward ongoing upkeep, like
        dependency bumps, docs, and cleanup, that would otherwise go unfunded.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {pools.length === 0 ? (
          <EmptyState
            icon={Droplets}
            title="No maintenance pools yet"
            description="Maintenance pools will appear here once sponsors set them up for ongoing upkeep."
          />
        ) : pools.map((pool) => (
          <Card key={pool.id}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{pool.repo}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
              {formatCurrency(pool.balance, pool.asset)} balance
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {formatCurrency(pool.monthlyDeposit, pool.asset)} deposited monthly
            </p>
            <PoolDepositButton poolId={pool.id} poolRepo={pool.repo} asset={pool.asset} />
          </Card>
        ))}
      </div>
    </div>
  );
}
