import { cn } from "@/lib/utils";
import type { BountyStatus, Difficulty } from "@/types";

const statusStyles: Record<BountyStatus, string> = {
  open: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  funded: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  claimed: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  in_review: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30",
  merged: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  refunded: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
  expired: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
};

const difficultyStyles: Record<Difficulty, string> = {
  beginner: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  intermediate: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  advanced: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  expert: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:ring-fuchsia-500/30",
};

function BaseBadge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Human label per status. Replaces `status.replace("_", " ")`, which rendered
 *  "in review" in lower case and only ever replaced the *first* underscore, so
 *  a new multi-word status would leak its raw enum key to users. */
const statusLabels: Record<BountyStatus, string> = {
  open: "Open",
  funded: "Funded",
  claimed: "Claimed",
  in_review: "In Review",
  merged: "Merged",
  paid: "Paid",
  refunded: "Refunded",
  expired: "Expired",
};

export function StatusBadge({ status }: { status: BountyStatus }) {
  return (
    <BaseBadge className={statusStyles[status]}>
      {statusLabels[status]}
    </BaseBadge>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <BaseBadge className={difficultyStyles[difficulty]}>{difficulty}</BaseBadge>;
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <BaseBadge
      className={cn(
        "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
        className,
      )}
    >
      {children}
    </BaseBadge>
  );
}
