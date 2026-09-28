import type { Metadata } from "next";
import Link from "next/link";
import { GitPullRequest, FilterX } from "lucide-react";
import { fetchBounties } from "@/lib/api";
import { mockBounties } from "@/lib/mock-data";
import { BountyCard } from "@/components/bounty/BountyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { DataSourceNotice } from "@/components/ui/DataSourceNotice";
import { formatInteger } from "@/lib/utils";
import { messages, t } from "@/lib/messages";
import {
  applyBountyQuery,
  buildIssuesHref,
  isFilterActive,
  parseBountyQuery,
  SORT_LABELS,
  SORT_VALUES,
  STATUS_VALUES,
  DIFFICULTY_VALUES,
  ASSET_VALUES,
  type RawSearchParams,
} from "@/lib/bounty-query";

const issuesDescription =
  "Browse paid, escrow-backed GitHub issues funded through MergeFi and ready for contributors.";

export const metadata: Metadata = {
  title: "Paid Issues | MergeFi",
  description: issuesDescription,
  openGraph: {
    title: "Paid Issues | MergeFi",
    description: issuesDescription,
    url: "/issues",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paid Issues | MergeFi",
    description: issuesDescription,
  },
};

/**
 * Filter values offered by the status facet. `open` and `in_review` are the
 * two a contributor actually filters by; `all` clears the facet.
 */
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In review" },
] as const satisfies readonly { value: (typeof STATUS_VALUES)[number]; label: string }[];

const DIFFICULTY_LABELS: Record<(typeof DIFFICULTY_VALUES)[number], string> = {
  all: "Any difficulty",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

const ASSET_LABELS: Record<(typeof ASSET_VALUES)[number], string> = {
  all: "Any asset",
  USDC: "USDC",
  XLM: "XLM",
};

export default async function IssuesPage({
  searchParams,
}: {
  // Next 16 App Router: searchParams is a promise on server components.
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const query = parseBountyQuery(params);
  const filterActive = isFilterActive(query);

  const { data: bounties, source } = await fetchBounties(mockBounties, query);
  const { items: visible, page, totalPages, filteredCount } = applyBountyQuery(bounties, query);
  const total = bounties.length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          {messages["nav.bounties"]}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
          Paid issues
        </h1>
        <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
          Every bounty below is backed by funds already locked in a Soroban
          escrow contract. Claim one, open a pull request, and get paid the
          moment it&apos;s merged.
        </p>
      </div>

      {/* Sample-data provenance is independent of emptiness: a backend outage
          whose fallback list is empty is both "nothing to show" and "we could
          not reach the server". Both signals render, rather than one hiding
          the other. */}
      {source === "mock" && <DataSourceNotice className="mb-6" />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">Status:</span>
        {STATUS_FILTERS.map((f) => {
          const active = f.value === query.status;
          return (
            <Link
              key={f.value}
              href={buildIssuesHref(params, { status: f.value === "all" ? undefined : f.value })}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
                  : "rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }
            >
              {f.label}
            </Link>
          );
        })}
        <span className="ms-auto text-sm text-slate-500 dark:text-slate-400">
          {formatInteger(filteredCount)} of {formatInteger(total)}
        </span>
      </div>

      {/* Difficulty/asset/reward-range/sort are exposed as a plain GET form
          rather than client-side state — every combination stays a shareable,
          bookmarkable URL and the page works with JavaScript disabled. The
          hidden `status` field carries the pill selection above through the
          same submit, since HTML forms only send their own named fields. */}
      <form
        method="get"
        action="/issues"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40"
      >
        {query.status !== "all" && <input type="hidden" name="status" value={query.status} />}

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Difficulty
          <select
            name="difficulty"
            defaultValue={query.difficulty}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {DIFFICULTY_VALUES.map((value) => (
              <option key={value} value={value}>
                {DIFFICULTY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Asset
          <select
            name="asset"
            defaultValue={query.asset}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {ASSET_VALUES.map((value) => (
              <option key={value} value={value}>
                {ASSET_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Min reward
          <input
            type="number"
            inputMode="decimal"
            min={0}
            name="minReward"
            defaultValue={query.minReward ?? ""}
            placeholder="0"
            className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Max reward
          <input
            type="number"
            inputMode="decimal"
            min={0}
            name="maxReward"
            defaultValue={query.maxReward ?? ""}
            placeholder="Any"
            className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Sort by
          <select
            name="sort"
            defaultValue={query.sort}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {SORT_VALUES.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" size="sm">
          Apply filters
        </Button>
        {filterActive && (
          <Link
            href="/issues"
            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Clear all
          </Link>
        )}
      </form>

      {visible.length === 0 ? (
        filterActive ? (
          /* Filtered-to-zero. Distinguished from a genuinely empty platform
             because the fix is different: here the bounties exist and the
             visitor's own filter is hiding them, so the CTA clears the filter
             instead of inviting them to fund one. */
          <EmptyState
            icon={FilterX}
            tone="info"
            size="sm"
            headingLevel="h2"
            title={t("empty.issues.filtered.title")}
            description={t("empty.issues.filtered.description", { total: formatInteger(total) })}
            action={
              <Link href="/issues">
                <Button size="sm" variant="outline">
                  {t("empty.issues.filtered.cta")}
                </Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={GitPullRequest}
            tone="neutral"
            headingLevel="h2"
            title={t("empty.issues.none.title")}
            description={t("empty.issues.none.description")}
            action={
              <Link href="/connect">
                <Button size="sm">{t("empty.issues.none.cta")}</Button>
              </Link>
            }
          />
        )
      ) : (
        <>
          <h2 className="sr-only">Available bounties</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Bounty board pages"
              className="mt-8 flex items-center justify-center gap-4"
            >
              <Link
                href={buildIssuesHref(params, { page: String(Math.max(1, page - 1)) })}
                aria-disabled={page <= 1}
                className={
                  page <= 1
                    ? "pointer-events-none rounded-md px-3 py-1.5 text-sm text-slate-300 dark:text-slate-700"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }
              >
                Previous
              </Link>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Page {formatInteger(page)} of {formatInteger(totalPages)}
              </span>
              <Link
                href={buildIssuesHref(params, {
                  page: String(Math.min(totalPages, page + 1)),
                })}
                aria-disabled={page >= totalPages}
                className={
                  page >= totalPages
                    ? "pointer-events-none rounded-md px-3 py-1.5 text-sm text-slate-300 dark:text-slate-700"
                    : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }
              >
                Next
              </Link>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
