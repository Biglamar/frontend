"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DollarSign, GitMerge, TrendingUp, ListChecks, GitPullRequest } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { StatCard, type StatCardStatus } from "@/components/ui/StatCard";
import { BarChart } from "@/components/ui/BarChart";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { BountyCard } from "@/components/bounty/BountyCard";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import { apiRequest, fetchBounties } from "@/lib/api";
import {
  mockReputationProfiles,
  mockBounties,
  recentActivity,
  contributorEarningsHistory,
  contributorSparkline,
} from "@/lib/mock-data";
import { useAuth } from "@/context/AuthContext";
import type { Bounty } from "@/types";

interface ReputationSnapshot {
  totalEarnings: string;
  mergedPrCount: number;
  completionRate: string;
}

interface DashboardStats {
  handle: string;
  lifetimeEarnings: number;
  mergedPRs: number;
  completionRate: number;
}

const earningsChartData = contributorEarningsHistory.map((value, i) => ({
  label: `W${i + 1}`,
  value,
}));

export default function ContributorDashboardClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bounties, setBounties] = useState<Bounty[]>(mockBounties);
  const [isLive, setIsLive] = useState(false);
  const [tab, setTabState] = useState<"active" | "completed">(
    (searchParams.get("tab") as "active" | "completed") || "active"
  );
  // Explicit fetch status: starts "loading" so cards shimmer rather than
  // flashing zeroes while the auth check + API call are in flight.
  const [fetchStatus, setFetchStatus] = useState<StatCardStatus>("loading");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      const demo = mockReputationProfiles.priyaeth;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStats({
        handle: demo.handle,
        lifetimeEarnings: demo.lifetimeEarnings,
        mergedPRs: demo.mergedPRs,
        completionRate: demo.completionRate,
      });
      setFetchStatus("loaded");
      setIsLive(false);
      return;
    }

    setFetchStatus("loading");

    // Parallelize independent fetches: bounties and reputation are unrelated
    // resources — no reason to waterfall them (#8).
    const bountiesResult = fetchBounties(mockBounties);
    const reputationResult = apiRequest<ReputationSnapshot | null>(
      `/reputation/${user.id}`,
    ).then(
      (snapshot) => ({
        handle: user.username,
        lifetimeEarnings: snapshot ? Number(snapshot.totalEarnings) : 0,
        mergedPRs: snapshot ? snapshot.mergedPrCount : 0,
        completionRate: snapshot ? Number(snapshot.completionRate) / 100 : 0,
      } as DashboardStats | null),
      () => null,
    );

    void Promise.all([bountiesResult, reputationResult]).then(
      ([bountiesRes, statsResult]) => {
        setBounties(bountiesRes.data);
        if (statsResult) {
          setStats(statsResult);
          setFetchStatus("loaded");
        } else {
          setStats(null);
          setFetchStatus("error");
        }
        setIsLive(true);
      },
    );
  }, [user, loading]);

  // Derive display handle: show username if live, else demo handle.
  const handle = stats?.handle ?? (user?.username ?? "you");

  const mine = bounties.filter((b) => b.claimedBy === handle);
  const activeClaims = mine.filter((b) => !["paid", "refunded", "expired"].includes(b.status));
  const completedClaims = mine.filter((b) => b.status === "paid");
  const available = bounties.filter((b) => b.status === "open");
  const shownClaims = tab === "active" ? activeClaims : completedClaims;

  const setTab = useCallback(
    (newTab: "active" | "completed") => {
      setTabState(newTab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", newTab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <DashboardShell
      role="contributor"
      title={`Welcome back, @${handle}`}
      subtitle={isLive ? undefined : "Sign in with GitHub to see your own earnings and claims."}
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
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            Find work
          </span>
        </Link>
      }
    >
      {/* StatCards show skeletons on initial load, errors on fetch failure —
          never a misleading "0 USDC" or "0 PRs" during loading/error states. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Lifetime earnings"
          value={stats?.lifetimeEarnings}
          format="currency"
          status={fetchStatus}
          icon={DollarSign}
          trend={fetchStatus === "loaded" ? 12 : undefined}
          sparkline={fetchStatus === "loaded" ? contributorEarningsHistory : undefined}
          zeroLabel="No earnings yet"
        />
        <StatCard
          label="Merged PRs"
          value={stats?.mergedPRs}
          format="count"
          status={fetchStatus}
          icon={GitMerge}
          trend={fetchStatus === "loaded" ? 8 : undefined}
          sparkline={fetchStatus === "loaded" ? contributorSparkline : undefined}
          zeroLabel="No merged PRs yet"
        />
        <StatCard
          label="Completion rate"
          // Completion rate is a fraction (0–1); format="percent" multiplies by 100
          value={stats?.completionRate}
          format="percent"
          status={fetchStatus}
          icon={TrendingUp}
          zeroLabel="No completions yet"
        />
        <StatCard
          label="Active claims"
          // Only derive activeClaims.length when stats is resolved — avoids
          // passing length=0 (via an empty filter on handle="you") while
          // the fetch is still in-flight or has errored.
          value={stats !== null ? activeClaims.length : undefined}
          format="count"
          status={fetchStatus}
          icon={ListChecks}
          zeroLabel="No active claims"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-slate-900 dark:text-white">Earnings, last 8 weeks</h2>
            {isLive && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                Sample data
              </span>
            )}
          </div>
          <div className="mt-6">
            <BarChart data={earningsChartData} formatValue={(v) => formatCurrency(v)} />
          </div>
        </Card>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-slate-900 dark:text-white">Recent activity</h2>
            {isLive && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                Sample data
              </span>
            )}
          </div>
          <div className="mt-4">
            <ActivityList events={recentActivity.slice(0, 4)} />
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Your claims</h2>
        <Tabs
          tabs={[
            { key: "active", label: "Active", count: activeClaims.length },
            { key: "completed", label: "Completed", count: completedClaims.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>
      <div
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="mt-6 grid gap-4 md:grid-cols-2"
      >
        {shownClaims.map((bounty) => (
          <BountyCard key={bounty.id} bounty={bounty} />
        ))}
      </div>
      {shownClaims.length === 0 && (
        <EmptyState
          icon={GitPullRequest}
          title={tab === "active" ? "No active claims" : "Nothing completed yet"}
          description={
            tab === "active"
              ? "Claim a bounty from the list below to get started."
              : "Completed and paid-out bounties will show up here."
          }
          action={
            tab === "active" ? (
              <a href="#open-bounties" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                Browse open bounties
              </a>
            ) : undefined
          }
        />
      )}

      {/* "available" is every open bounty in whatever order the backend/mock
          data returns, sliced to the first 4 — no relevance scoring against
          this contributor's history/languages/orgs. "Open bounties" is the
          honest label until real personalization exists (#239). */}
      <h2 className="mt-12 text-xl font-semibold text-slate-900 dark:text-white">
        Open bounties
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {available.slice(0, 4).map((bounty) => (
          <BountyCard key={bounty.id} bounty={bounty} />
        ))}
      </div>
    </DashboardShell>
  );
}
