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
import type { Bounty } from "@/types";

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
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

function coerceStatusFilter(raw: string | string[] | undefined): StatusFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return STATUS_FILTERS.some((f) => f.value === value) ? (value as StatusFilter) : "all";
}

function applyStatusFilter(bounties: Bounty[], filter: StatusFilter): Bounty[] {
  if (filter === "all") return bounties;
  return bounties.filter((b) => b.status === filter);
}

export default async function IssuesPage({
  searchParams,
}: {
  // Next 16 App Router: searchParams is a promise on server components.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = coerceStatusFilter(params.status);
  const filterActive = status !== "all";

  const { data: bounties, source } = await fetchBounties(mockBounties);
  const visible = applyStatusFilter(bounties, status);
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

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">Status:</span>
        {STATUS_FILTERS.map((f) => {
          const active = f.value === status;
          return (
            <Link
              key={f.value}
              href={f.value === "all" ? "/issues" : `/issues?status=${f.value}`}
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
          {formatInteger(visible.length)} of {formatInteger(total)}
        </span>
      </div>

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
        </>
      )}
    </div>
  );
}
