import {
  CheckCheck,
  CircleDashed,
  Eye,
  Flame,
  Gem,
  GitMerge,
  Lock,
  Sprout,
  TimerOff,
  Undo2,
  UserCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BountyStatus, Difficulty } from "@/types";

/**
 * Badge encoding (#49)
 *
 * Colour is never the only carrier of meaning. Every state pairs a hue with
 * (1) a distinct lucide icon and (2) a text label, and the money-adjacent
 * pairs that are most easily confused get a third cue:
 *
 *   funded (escrowed)  → Lock icon, tinted sky, solid outline
 *   paid   (released)  → CheckCheck icon, *filled* emerald, white text
 *
 * `paid` is the only status with a solid fill, so it reads differently from
 * every tinted badge even in greyscale. `refunded` and `open` use a dashed
 * outline (nothing is committed / money returned) to separate them from the
 * solid-outlined states. Emerald is used for the terminal "money delivered"
 * state and for `beginner`; both are non-interactive pills, so they don't
 * collide with the emerald button affordance (buttons are never pill-shaped
 * with an icon prefix).
 *
 * Contrast (WCAG AA, 4.5:1) of every text/background pair is asserted in
 * Badge.contrast.test.ts against the Tailwind palette hexes below.
 */
interface BadgeStyle {
  className: string;
  Icon: LucideIcon;
}

const statusStyles: Record<BountyStatus, BadgeStyle> = {
  open: {
    Icon: CircleDashed,
    className:
      "bg-slate-100 text-slate-700 ring-slate-300 ring-dashed dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600",
  },
  funded: {
    Icon: Lock,
    className:
      "bg-sky-50 text-sky-800 ring-sky-300 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/40",
  },
  claimed: {
    Icon: UserCheck,
    className:
      "bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/40",
  },
  in_review: {
    Icon: Eye,
    className:
      "bg-indigo-50 text-indigo-800 ring-indigo-300 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/40",
  },
  merged: {
    Icon: GitMerge,
    className:
      "bg-violet-50 text-violet-800 ring-violet-300 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/40",
  },
  paid: {
    Icon: CheckCheck,
    className:
      "bg-emerald-700 text-white ring-emerald-700 font-semibold dark:bg-emerald-500 dark:text-emerald-950 dark:ring-emerald-500",
  },
  refunded: {
    Icon: Undo2,
    className:
      "bg-slate-100 text-slate-700 ring-slate-400 ring-dashed dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500",
  },
  expired: {
    Icon: TimerOff,
    className:
      "bg-rose-50 text-rose-800 ring-rose-300 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/40",
  },
};

const difficultyStyles: Record<Difficulty, BadgeStyle> = {
  beginner: {
    Icon: Sprout,
    className:
      "bg-emerald-50 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/40",
  },
  intermediate: {
    Icon: Zap,
    className:
      "bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/40",
  },
  advanced: {
    Icon: Flame,
    className:
      "bg-rose-50 text-rose-800 ring-rose-300 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/40",
  },
  expert: {
    Icon: Gem,
    className:
      "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-300 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:ring-fuchsia-500/40",
  },
};

function BaseBadge({
  className,
  Icon,
  children,
}: {
  className?: string;
  Icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />}
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
    <BaseBadge
      className={statusStyles[status].className}
      Icon={statusStyles[status].Icon}
    >
      {statusLabels[status]}
    </BaseBadge>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const { className, Icon } = difficultyStyles[difficulty];
  return (
    <BaseBadge className={cn("capitalize", className)} Icon={Icon}>
      {difficulty}
    </BaseBadge>
  );
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
