import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import type { Bounty, BountyStatus } from "@/types";

// Statuses shown as a pipeline column, in left-to-right order.
//
// "paid"/"refunded"/"expired" are deliberately NOT columns here: once a
// bounty leaves escrow (paid out, refunded, or expired unclaimed) it's a
// terminal state, no longer "in the pipeline" in the sense this board
// tracks. "merged" IS a column: it's still escrow-locked (see
// ESCROW_LOCKED_EXCLUDED_STATUSES in page.tsx) and, per #88, the single
// most important state for a maintainer to watch closely -- it's the last
// step before the automatic payout webhook fires, and the one place a
// stuck/delayed webhook would be most consequential to notice quickly.
//
// Every status this board omits a column for should also be excluded from
// "Value locked in escrow" on the page above (and vice versa) -- kept
// consistent deliberately; see the pipeline/escrow consistency test in
// PipelineBoard.test.tsx.
export const pipelineStages: { status: BountyStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "funded", label: "Funded" },
  { status: "claimed", label: "Claimed" },
  { status: "in_review", label: "In review" },
  { status: "merged", label: "Awaiting payout" },
];

// Statuses excluded from "Value locked in escrow" on the page above: "open"
// hasn't been funded yet (nothing in escrow to lock), and
// "paid"/"refunded"/"expired" have already left escrow. Every other status
// -- "funded", "claimed", "in_review", "merged" -- is still escrow-locked
// and must have a corresponding entry in pipelineStages above. Kept in the
// same file as pipelineStages specifically so the two can't silently drift
// apart the way they did before #88 (the stat counted "merged" as
// escrow-locked while the board had no column for it) -- see the
// consistency test in PipelineBoard.test.tsx.
export const ESCROW_LOCKED_EXCLUDED_STATUSES: BountyStatus[] = [
  "open",
  "paid",
  "refunded",
  "expired",
];

// Cap per-column rendering so a busy repo's pipeline (potentially hundreds
// of bounties in one status) doesn't render an unbounded, unvirtualized
// list of cards on every dashboard visit (#226).
const MAX_VISIBLE_PER_COLUMN = 8;

function PipelineColumn({
  label,
  bounties,
}: {
  label: string;
  bounties: Bounty[];
}) {
  const visible = bounties.slice(0, MAX_VISIBLE_PER_COLUMN);
  const hiddenCount = bounties.length - visible.length;

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {bounties.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {visible.map((b) => (
          <Link
            key={b.id}
            href={`/issues/${b.id}`}
            title={b.title}
            aria-label={`${b.title}, ${formatCurrency(b.reward, b.asset)}`}
            className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
          >
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">
              {b.org}/{b.repo} #{b.issueNumber}
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
              {b.title}
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(b.reward, b.asset)}
            </p>
          </Link>
        ))}
        {bounties.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            Nothing here
          </p>
        )}
        {hiddenCount > 0 && (
          <Link
            href="/issues"
            className="block rounded-xl border border-dashed border-slate-200 px-3 py-2 text-center text-xs font-medium text-indigo-600 transition-colors hover:border-indigo-300 dark:border-slate-800 dark:text-indigo-400 dark:hover:border-indigo-700"
          >
            View all {bounties.length} in Bounty pipeline
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the Kanban-style pipeline board. Extracted from the page's async
 * Server Component (#88) so it's a plain function of already-fetched
 * `bounties`, testable without mocking data-fetching, DashboardShell, etc.
 */
export function PipelineBoard({ bounties }: { bounties: Bounty[] }) {
  const byStatus = new Map<BountyStatus, Bounty[]>();
  for (const bounty of bounties) {
    const group = byStatus.get(bounty.status);
    if (group) {
      group.push(bounty);
    } else {
      byStatus.set(bounty.status, [bounty]);
    }
  }

  return (
    <Card className="mt-8">
      <h2 className="font-medium text-slate-900 dark:text-white">Pipeline</h2>
      <div className="mt-5 flex gap-4 overflow-x-auto">
        {pipelineStages.map((stage) => (
          <PipelineColumn
            key={stage.status}
            label={stage.label}
            bounties={byStatus.get(stage.status) ?? []}
          />
        ))}
      </div>
    </Card>
  );
}
