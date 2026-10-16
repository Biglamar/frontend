import Link from "next/link";
import { Layers, Clock, Coins, FolderGit2, CheckCircle2 } from "lucide-react";
import { fetchBounties } from "@/lib/api";
import { mockBounties, recentActivity, bountiesCompletedSparkline } from "@/lib/mock-data";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SampleDataChip } from "@/components/ui/DataSourceNotice";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { formatCurrency, sumMoney } from "@/lib/utils";
import { t } from "@/lib/messages";
import { PipelineBoard, ESCROW_LOCKED_EXCLUDED_STATUSES } from "./PipelineBoard";

export const metadata = {
  title: "Maintainer Dashboard | MergeFi",
};

export default async function MaintainerDashboardPage() {
  // Maintainer dashboard is a Server Component (no client-side loading state).
  // fetchBounties (lib/api.ts) already catches every failure internally and
  // resolves to the `fallback` argument instead of rejecting — it can never
  // throw, so a try/catch around it here would be dead code. Detect the
  // fallback case instead by reference: fetchBounties returns the exact
  // fallback array on failure, but always a freshly-mapped array (a new
  // reference, even if its contents happened to match) on a real live
  // fetch, so this reliably distinguishes "live data" from "backend down,
  // showing mockBounties" without changing fetchBounties' shared contract
  // (#240).
  const { data: bounties, source } = await fetchBounties(mockBounties);
  const statStatus: "loaded" | "error" = source === "live" ? "loaded" : "error";

  const needsReview = bounties.filter((b) => b.status === "in_review");
  const open = bounties.filter((b) => b.status === "open" || b.status === "funded");
  const repoCount = new Set(bounties.map((b) => `${b.org}/${b.repo}`)).size;
  // Summed in integer minor units to avoid float drift (#353). 7 decimals
  // covers both USDC (2) and XLM (7) rewards without truncation.
  const totalEscrow = sumMoney(
    bounties
      .filter((b) => !ESCROW_LOCKED_EXCLUDED_STATUSES.includes(b.status))
      .map((b) => b.reward),
    7,
  );

  return (
    <DashboardShell
      role="maintainer"
      title="Bounty pipeline"
      subtitle="Create bounties from your GitHub issues and approve completed work. Payout release happens automatically once a linked pull request is merged."
      action={
        // Bounties are created from your GitHub issues (per the subtitle
        // above) — /issues is the same destination the contributor and
        // sponsor dashboards' equivalent action buttons already link to
        // for picking a bounty to work with (#241).
        <Link href="/issues">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            Create bounty
          </span>
        </Link>
      }
    >
      {/* Pass statStatus so that a fetchBounties failure renders error states
          on all four cards instead of silently showing zeros. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Open bounties"
          value={open.length}
          format="count"
          status={statStatus}
          icon={Layers}
          zeroLabel="No open bounties"
        />
        <StatCard
          label="Awaiting review"
          value={needsReview.length}
          format="count"
          status={statStatus}
          icon={Clock}
          zeroLabel="All caught up"
        />
        <StatCard
          label="Value locked in escrow"
          value={totalEscrow}
          format="currency"
          status={statStatus}
          icon={Coins}
          sparkline={statStatus === "loaded" ? bountiesCompletedSparkline : undefined}
          zeroLabel="Nothing in escrow yet"
        />
        <StatCard
          label="Repositories synced"
          value={repoCount}
          format="count"
          status={statStatus}
          icon={FolderGit2}
          zeroLabel="No repositories yet"
        />
      </div>

      <PipelineBoard bounties={bounties} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Pull requests awaiting merge
          </h2>
          <div className="mt-4 space-y-3">
            {needsReview.map((bounty) => (
              <Card
                key={bounty.id}
                padding="sm"
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar seed={`${bounty.org}/${bounty.repo}`} size={36} className="rounded-xl" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {bounty.org}/{bounty.repo} #{bounty.issueNumber}
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">{bounty.title}</p>
                    {bounty.claimedBy && (
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        by {bounty.claimedBy}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={bounty.status} />
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(bounty.reward, bounty.asset)}
                  </span>
                </div>
              </Card>
            ))}
            {needsReview.length === 0 && (
              /* A maintainer with zero items to review has *finished*, not
                 failed — the review queue draining is the success case. Toned
                 as success with no CTA pushing more work at them, and the
                 secondary action points at bounties they could open rather
                 than at more reviews. */
              <EmptyState
                icon={CheckCircle2}
                tone="success"
                size="sm"
                title={t("empty.review.clear.title")}
                description={t("empty.review.clear.description")}
                secondaryAction={
                  <Link
                    href="/issues"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    {t("empty.review.clear.cta")}
                  </Link>
                }
              />
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Recent activity
            </h2>
            {source === "mock" && <SampleDataChip />}
          </div>
          <div className="mt-4">
            <ActivityList events={recentActivity.slice(0, 5)} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
