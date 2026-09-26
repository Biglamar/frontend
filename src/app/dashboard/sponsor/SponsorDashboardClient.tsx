"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Receipt, Lock, FolderGit2, Inbox, CheckCircle2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { StatCard, type StatCardStatus } from "@/components/ui/StatCard";
import { BarChart } from "@/components/ui/BarChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { SampleDataChip } from "@/components/ui/DataSourceNotice";
import { Button } from "@/components/ui/Button";
import { BountyCard } from "@/components/bounty/BountyCard";
import { Card } from "@/components/ui/Card";
import { formatCurrency, subtractMoney } from "@/lib/utils";
import { t } from "@/lib/messages";
import { apiRequest } from "@/lib/api";
import { adaptBounty, type RawBounty, type RawMilestone } from "@/lib/adapters";
import {
  mockSponsorSummary,
  mockBounties,
  recentActivity,
  sponsorSpendHistory,
  sponsorSpendByRepo,
  budgetSparkline,
} from "@/lib/mock-data";
import { useAuth } from "@/context/AuthContext";
import type { Bounty } from "@/types";

interface SponsorDashboardData {
  activeBounties: Bounty[];
  totalSpent: number;
  budgetLocked: number;
  repoCount: number;
}

const spendChartData = sponsorSpendHistory.map((value, i) => ({
  label: `W${i + 1}`,
  value,
}));

const maxRepoSpend = Math.max(...sponsorSpendByRepo.map((r) => r.amount));

export default function SponsorDashboardClient() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<SponsorDashboardData | null>(null);
  const [isLive, setIsLive] = useState(false);
  // Explicit fetch status so StatCards can show skeletons rather than
  // hiding the whole page, and errors rather than flashing zeroes.
  const [fetchStatus, setFetchStatus] = useState<StatCardStatus>("loading");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Demo-mode fallback when signed out.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData({
        activeBounties: mockBounties.filter((b) =>
          ["open", "funded", "claimed", "in_review"].includes(b.status),
        ),
        // Integer minor-unit arithmetic, not raw float subtraction (#353).
        totalSpent: subtractMoney(
          mockSponsorSummary.totalFunded,
          mockSponsorSummary.budgetRemaining,
        ),
        budgetLocked: mockSponsorSummary.budgetRemaining,
        repoCount: mockSponsorSummary.repos.length,
      });
      setFetchStatus("loaded");
      setIsLive(false);
      return;
    }

    setFetchStatus("loading");

    apiRequest<{
      activeBounties: RawBounty[];
      totalSpent: number;
      budgetLocked: number;
      activeMilestones: RawMilestone[];
    }>(`/sponsors/${user.id}/dashboard`)
      .then((raw) => {
        const activeBounties = raw.activeBounties.map(adaptBounty);
        const repoCount = new Set(activeBounties.map((b) => `${b.org}/${b.repo}`)).size;
        setData({
          activeBounties,
          totalSpent: raw.totalSpent,
          budgetLocked: raw.budgetLocked,
          repoCount,
        });
        setFetchStatus("loaded");
        setIsLive(true);
      })
      .catch(() => {
        // On error: keep data null so cards can show their error state.
        // Do NOT set values to 0 — that would be indistinguishable from a
        // real zero balance, which is a trust-eroding false signal for a sponsor.
        setData(null);
        setFetchStatus("error");
        setIsLive(true);
      });
    // Depend on user?.id, not the whole user object: AuthContext#refresh()
    // sets a freshly-parsed user object on every call — including unrelated
    // cross-tab token-storage pings — so a reference-based dependency
    // re-ran this fetch even when the signed-in sponsor's identity hadn't
    // actually changed (#243).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading]);

  // Derive per-card values only when data is available.
  const totalSpent = data?.totalSpent;
  const activeBountyCount = data?.activeBounties.length;
  const budgetLocked = data?.budgetLocked;
  const repoCount = data?.repoCount;

  /* Any money or repo history means this sponsor has funded before, so an
     empty active list means "all settled" rather than "never started". */
  const sponsorHasHistory =
    (data?.totalSpent ?? 0) > 0 ||
    (data?.budgetLocked ?? 0) > 0 ||
    (data?.repoCount ?? 0) > 0;

  return (
    <DashboardShell
      role="sponsor"
      title={user ? `${user.displayName ?? user.username}'s sponsorships` : mockSponsorSummary.name}
      subtitle={
        isLive
          ? "Track spending, active bounties, and escrowed budget across the repositories you fund."
          : "Sign in with GitHub to see your own sponsorships. Showing sample data for now."
      }
      badge={
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            isLive
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
              : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
          }`}
        >
          {isLive ? "Live data" : "Demo data"}
        </span>
      }
      action={
        <Link href="/issues">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900">
            Fund a bounty
          </span>
        </Link>
      }
    >
      {/* Stat cards — page structure is always visible; individual cards
          show skeletons during load and error states on failure, so no part
          of the UI flashes a 0 that looks like a real zero balance. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total paid out"
          value={totalSpent}
          format="currency"
          status={fetchStatus}
          icon={Receipt}
          trend={fetchStatus === "loaded" ? 18 : undefined}
          sparkline={fetchStatus === "loaded" ? sponsorSpendHistory : undefined}
        />
        <StatCard
          label="Active bounties"
          value={activeBountyCount}
          format="count"
          status={fetchStatus}
          icon={Wallet}
          zeroLabel="No bounties yet"
        />
        <StatCard
          label="Locked in escrow"
          value={budgetLocked}
          format="currency"
          status={fetchStatus}
          icon={Lock}
          sparkline={fetchStatus === "loaded" ? budgetSparkline : undefined}
          zeroLabel="Nothing in escrow"
        />
        <StatCard
          label="Repositories"
          value={repoCount}
          format="count"
          status={fetchStatus}
          icon={FolderGit2}
          zeroLabel="No repos funded yet"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-slate-900 dark:text-white">Spend, last 8 weeks</h2>
            {isLive && <SampleDataChip />}
          </div>
          <div className="mt-6">
            <BarChart data={spendChartData} formatValue={(v) => formatCurrency(v)} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-slate-900 dark:text-white">Spend by repository</h2>
            {isLive && <SampleDataChip />}
          </div>
          <div className="mt-5 space-y-3">
            {sponsorSpendByRepo.map((r) => (
              <div key={r.repo}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{r.repo}</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatCurrency(r.amount)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                    style={{ width: `${(r.amount / maxRepoSpend) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-slate-900 dark:text-white">Active bounties</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(data?.activeBounties ?? []).map((bounty) => (
          <BountyCard key={bounty.id} bounty={bounty} />
        ))}
      </div>
      {data?.activeBounties?.length === 0 && (
        /* Two genuinely different situations collapse into the same
           "0 active bounties" count, and the previous single copy treated
           both as "fund something", which is the wrong advice for a sponsor
           whose entire portfolio has already been paid out:
             - never funded anything   → needs a "fund your first" CTA
             - everything has settled   → this is the success state, and
                                         suggesting they fund more is noise */
        sponsorHasHistory ? (
          <EmptyState
            icon={CheckCircle2}
            tone="success"
            className="md:col-span-2"
            headingLevel="h3"
            title={t("empty.sponsor.settled.title")}
            description={t("empty.sponsor.settled.description")}
          />
        ) : (
          <EmptyState
            icon={Inbox}
            tone="neutral"
            className="md:col-span-2"
            headingLevel="h3"
            title={t("empty.sponsor.none.title")}
            description={t("empty.sponsor.none.description")}
            action={
              <Link href="/issues">
                <Button size="sm">{t("empty.sponsor.none.cta")}</Button>
              </Link>
            }
          />
        )
      )}

      <div className="mt-10 flex items-center gap-2">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recent activity</h2>
        {isLive && <SampleDataChip />}
      </div>
      <div className="mt-4">
        <ActivityList events={recentActivity.slice(0, 5)} />
      </div>

      {/* Dev-only: visual kitchen sink — renders all four StatCard states
          side by side so any regression is immediately obvious during development. */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-12 border-t border-dashed border-slate-200 pt-8 dark:border-slate-800">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            StatCard state kitchen sink (dev only)
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Loading state" status="loading" icon={Receipt} />
            <StatCard label="Error state" status="error" icon={Receipt} />
            <StatCard
              label="Zero state"
              status="loaded"
              value={0}
              format="currency"
              icon={Receipt}
              zeroLabel="No spend yet"
            />
            <StatCard
              label="Large value"
              status="loaded"
              value={1_284_999}
              format="currency"
              icon={Receipt}
              trend={5}
            />
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
