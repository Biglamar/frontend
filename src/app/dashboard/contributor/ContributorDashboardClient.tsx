"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DollarSign, GitMerge, TrendingUp, ListChecks, GitPullRequest } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { StatCard, type StatCardStatus } from "@/components/ui/StatCard";
import { BarChart } from "@/components/ui/BarChart";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { SampleDataChip } from "@/components/ui/DataSourceNotice";
import { BountyCard } from "@/components/bounty/BountyCard";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import { t } from "@/lib/messages";
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

/**
 * Where a section's numbers came from.
 *
 * This page has two genuinely independent fetches — the reputation/stats
 * request and the bounty list — that feed one shared "Live data" badge and
 * two different regions of the page. Tracking each separately is what lets
 * the badge say "Mixed data" instead of claiming the whole page is live while
 * the bounty lists below it are silently the bundled mock rows.
 *
 * - `loading` — no response yet (also the initial state, before the signed-out
 *   branch has run).
 * - `live`   — the backend answered.
 * - `mock`   — signed out, or `fetchBounties` fell back to its bundled
 *   argument after a failed request (it swallows the error internally).
 * - `error`  — the request failed and there is no mock fallback for it; the
 *   StatCards render their own error state rather than a fabricated zero.
 */
type DataSource = "loading" | "live" | "mock" | "error";

export default function ContributorDashboardClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bounties, setBounties] = useState<Bounty[]>(mockBounties);
  const [statsSource, setStatsSource] = useState<DataSource>("loading");
  const [bountiesSource, setBountiesSource] = useState<DataSource>("loading");
  const [tab, setTabState] = useState<"active" | "completed">(
    (searchParams.get("tab") as "active" | "completed") || "active"
  );
  // Explicit fetch status: starts "loading" so cards shimmer rather than
  // flashing zeroes while the auth check + API call are in flight.
  const [fetchStatus, setFetchStatus] = useState<StatCardStatus>("loading");

  // Guards the effect below against out-of-order responses. AuthContext's
  // refresh() assigns a brand-new `user` object on every successful re-auth,
  // so an unrelated refresh anywhere in the tree (WalletContext.connect()'s
  // `await refresh()`, a cross-tab login, ...) re-runs this effect while the
  // previous run's requests may still be in flight — and the reputation call
  // hits `/reputation/:id`, not a cheap cached read. Bumping a counter on
  // every run and dropping any response whose counter is stale means the
  // *last-started* request wins, not whichever happened to resolve last.
  const fetchGeneration = useRef(0);

  useEffect(() => {
    const generation = ++fetchGeneration.current;
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
      setStatsSource("mock");
      // Signed out renders the bundled mock bounties by design, not by
      // failure — record it as `mock` so the badge reads a truthful
      // "Demo data" rather than falling through to the mixed case.
      setBountiesSource("mock");
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
        // A newer run has started since this one — its response is the one
        // that should land. Dropping this one is what stops a slow, earlier
        // recompute from overwriting fresher stats.
        if (generation !== fetchGeneration.current) return;

        setBounties(bountiesRes.data);
        setBountiesSource(bountiesRes.source);
        if (statsResult) {
          setStats(statsResult);
          setFetchStatus("loaded");
          setStatsSource("live");
        } else {
          setStats(null);
          setFetchStatus("error");
          setStatsSource("error");
        }
      },
    );
    // Depend on `user?.id`, not the whole object: refresh() builds a fresh
    // object each call, so an object-identity dependency re-ran this fetch
    // for reasons that had nothing to do with *who* is signed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading]);

  /* The badge is a page-wide claim, so it only says "Live data" when both
     independent fetches actually reached the backend. Anything else that
     isn't a pure signed-out demo is "Mixed data" — a page can't be honestly
     labelled live while half of it is the bundled fixture. While either
     source is still in flight, keep the badge on its initial "Demo data"
     rather than guessing. */
  const sourcesSettled = statsSource !== "loading" && bountiesSource !== "loading";
  const allLive = statsSource === "live" && bountiesSource === "live";
  const allMock = statsSource === "mock" && bountiesSource === "mock";
  const badgeLabel = !sourcesSettled ? "Demo data" : allLive ? "Live data" : allMock ? "Demo data" : "Mixed data";
  const isLive = badgeLabel === "Live data";
  /* Only called out sectionally in the partial-failure case: on a
     signed-out demo the page badge already says "Demo data", so repeating
     the chip on every list would be noise rather than information. */
  const showBountySampleChip = sourcesSettled && bountiesSource === "mock" && statsSource !== "mock";

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
      subtitle={user ? undefined : "Sign in with GitHub to see your own earnings and claims."}
      badge={
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            badgeLabel === "Live data"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
              : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
          }`}
        >
          {badgeLabel}
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
            {isLive && <SampleDataChip />}
          </div>
          <div className="mt-6">
            <BarChart data={earningsChartData} formatValue={(v) => formatCurrency(v)} />
          </div>
        </Card>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-slate-900 dark:text-white">Recent activity</h2>
            {isLive && <SampleDataChip />}
          </div>
          <div className="mt-4">
            <ActivityList events={recentActivity.slice(0, 4)} />
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Your claims</h2>
          {/* Marked in place when this list is the mock fallback but the
              stats above it are real — the page badge alone can't say which
              half of a "Mixed data" page you're looking at. */}
          {showBountySampleChip && <SampleDataChip />}
        </div>
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
        /* Both tabs are "start here" states, but they say different things:
           no active claims is an invitation to pick up work, while nothing
           completed yet is an explanation of what completion *means* — so the
           copy differs and only the active tab gets a forward CTA. */
        <EmptyState
          icon={GitPullRequest}
          tone="neutral"
          className="md:col-span-2"
          headingLevel="h3"
          title={t(tab === "active" ? "empty.claims.active.title" : "empty.claims.completed.title")}
          description={t(
            tab === "active"
              ? "empty.claims.active.description"
              : "empty.claims.completed.description",
          )}
          /* Both tabs are dead ends without a next step, so both get the same
             forward CTA — only the surrounding copy differs. */
          action={
            <a
              href="#open-bounties"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              {t(tab === "active" ? "empty.claims.active.cta" : "empty.claims.completed.cta")}
            </a>
          }
        />
      )}

      {/* "available" is every open bounty in whatever order the backend/mock
          data returns, sliced to the first 4 — no relevance scoring against
          this contributor's history/languages/orgs. "Open bounties" is the
          honest label until real personalization exists (#239). The
          `id="open-bounties"` is what the empty-state CTA above scrolls to;
          without it that anchor pointed at nothing. */}
      <div className="mt-12 flex items-center gap-2">
        <h2
          id="open-bounties"
          className="scroll-mt-24 text-xl font-semibold text-slate-900 dark:text-white"
        >
          Open bounties
        </h2>
        {showBountySampleChip && <SampleDataChip />}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {available.slice(0, 4).map((bounty) => (
          <BountyCard key={bounty.id} bounty={bounty} />
        ))}
      </div>
    </DashboardShell>
  );
}
