import Link from "next/link";
import { Clock, GitPullRequest } from "lucide-react";
import { StatusBadge, DifficultyBadge, Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatCurrency, daysUntil, formatDaysUntil } from "@/lib/utils";
import { stripMarkdownToPlainText } from "@/lib/markdown";
import type { Bounty } from "@/types";

const accentByDifficulty: Record<Bounty["difficulty"], string> = {
  beginner: "before:bg-emerald-400",
  intermediate: "before:bg-amber-400",
  advanced: "before:bg-rose-400",
  expert: "before:bg-fuchsia-400",
};

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const days = bounty.deadline ? daysUntil(bounty.deadline) : null;
  return (
    <Link
      href={`/issues/${bounty.id}`}
      prefetch={false}
      aria-label={`${bounty.title}, ${formatCurrency(bounty.reward, bounty.asset)}`}
      className={`relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all before:absolute before:inset-y-0 before:start-0 before:w-1 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-800 dark:bg-slate-900 ${accentByDifficulty[bounty.difficulty]}`}
    >
      <div className="flex items-start justify-between gap-4 ps-2">
        <div className="flex items-start gap-3">
          <Avatar seed={`${bounty.org}/${bounty.repo}`} size={36} className="mt-0.5 rounded-xl" />
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {bounty.org}/{bounty.repo} #{bounty.issueNumber}
            </p>
            <h3 className="mt-1 font-medium text-slate-900 dark:text-white">{bounty.title}</h3>
          </div>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {formatCurrency(bounty.reward, bounty.asset)}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 ps-2 text-sm text-slate-500 dark:text-slate-400">
        {stripMarkdownToPlainText(bounty.description)}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 ps-2">
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
      <div className="mt-4 flex items-center gap-4 ps-2 text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatDaysUntil(days)}
        </span>
        {bounty.claimedBy && (
          <span className="flex items-center gap-1">
            <GitPullRequest className="h-3.5 w-3.5" />
            claimed by {bounty.claimedBy}
          </span>
        )}
      </div>
    </Link>
  );
}
