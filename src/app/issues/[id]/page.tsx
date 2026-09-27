import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck, Clock, GitBranch, Milestone as MilestoneIcon, TriangleAlert } from "lucide-react";
import { fetchBounty } from "@/lib/api";
import { mockBounties } from "@/lib/mock-data";
import { StatusBadge, DifficultyBadge, Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { BountyDescription } from "@/components/bounty/BountyDescription";
import { formatCurrency, daysUntil, formatDaysUntil } from "@/lib/utils";
import type { BountyStatus } from "@/types";
import { IssueActions } from "./IssueActions";

const ESCROW_STATUS_LABELS: Record<BountyStatus, string> = {
  open: "Awaiting funding",
  funded: "Funds locked",
  claimed: "Funds locked",
  in_review: "Funds locked",
  merged: "Funds locked",
  paid: "Paid out",
  refunded: "Refunded to sponsor",
  expired: "Expired, unclaimed",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data: bounty } = await fetchBounty(
    id,
    mockBounties.find((b) => b.id === id),
  );

  if (!bounty) {
    return { title: "Issue not found | MergeFi" };
  }

  const title = `${bounty.title} — ${formatCurrency(bounty.reward, bounty.asset)} | MergeFi`;
  const description = bounty.description || `Fund or claim this bounty on MergeFi.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/issues/${id}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: bounty } = await fetchBounty(
    id,
    mockBounties.find((b) => b.id === id),
  );

  if (!bounty) notFound();

  const days = bounty.deadline ? daysUntil(bounty.deadline) : null;

  // adaptBounty runs validateTeamSplits on every bounty that has a team and
  // attaches the result as bounty.teamSplitsValid. Until now that flag was
  // computed and then never read anywhere in the app, so splits summing to
  // 85% or 110% rendered as a confident-looking public payout breakdown with
  // no indication anything was wrong. Reuse validateTeamSplits' own message
  // rather than inventing copy here; the fallback only fires in the
  // type-theoretically-possible case where valid is false but no message was
  // attached, and mirrors that message's exact wording.
  const splitsWarning =
    bounty.teamSplitsValid?.valid === false
      ? (bounty.teamSplitsValid.message ??
        `Team splits sum to ${bounty.teamSplitsValid.sum.toFixed(2)}% (expected 100%)`)
      : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {bounty.org}/{bounty.repo} #{bounty.issueNumber}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{bounty.title}</h1>
        <p className="text-2xl font-semibold text-slate-900 dark:text-white">
          {formatCurrency(bounty.reward, bounty.asset)}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={bounty.status} />
        <DifficultyBadge difficulty={bounty.difficulty} />
        <ul role="list" className="contents">
          {bounty.labels.map((label) => (
            <li key={label}>
              <Badge>{label}</Badge>
            </li>
          ))}
        </ul>
      </div>

      <BountyDescription description={bounty.description} />

      <div className={`mt-8 grid gap-4 ${bounty.milestoneId ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Card padding="sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span className="text-sm">Escrow status</span>
          </div>
          <p className="mt-2 font-medium text-slate-900 dark:text-white">
            {ESCROW_STATUS_LABELS[bounty.status]}
          </p>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span className="text-sm">Deadline</span>
          </div>
          <p className="mt-2 font-medium text-slate-900 dark:text-white">
            {formatDaysUntil(days)}
          </p>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <GitBranch className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span className="text-sm">Claimed by</span>
          </div>
          <p className="mt-2 font-medium text-slate-900 dark:text-white">
            {bounty.claimedBy ?? "Unclaimed"}
          </p>
        </Card>
        {bounty.milestoneId && (
          <Card padding="sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <MilestoneIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              <span className="text-sm">Milestone</span>
            </div>
            <p className="mt-2 font-medium text-slate-900 dark:text-white">
              Part of a funded milestone
            </p>
          </Card>
        )}
      </div>

      {bounty.teamSplits && bounty.teamSplits.length > 0 && (
        <div className="mt-8">
          <h2 className="font-medium text-slate-900 dark:text-white">Team payout split</h2>
          {splitsWarning && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">This payout split doesn&apos;t add up</p>
                <p className="mt-1">
                  {splitsWarning} — the listed shares don&apos;t cover the full
                  reward, so don&apos;t rely on them until the team&apos;s split
                  has been corrected.
                </p>
              </div>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {bounty.teamSplits.map((split, index) => (
              <div
                // adaptBounty defaults a missing role to a fixed
                // "Contributor" literal, so two splits that both lack an
                // explicit role produce a duplicate key on `role` alone —
                // include the index to guarantee uniqueness (#244).
                key={`${split.role}-${split.contributor ?? "unassigned"}-${index}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="text-slate-600 dark:text-slate-300">
                  {split.role}
                  {split.contributor ? ` (${split.contributor})` : ""}
                </span>
                {/* emerald-700 rather than emerald-600: 3.77:1 on white fails
                    WCAG AA for text, and this is a payout figure. emerald-700
                    measures 5.48:1. Dark mode already passed at 9.29:1. */}
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {split.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <IssueActions bounty={bounty} />
    </div>
  );
}
