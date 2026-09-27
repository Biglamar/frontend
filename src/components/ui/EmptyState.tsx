import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — "there is nothing here" affordance.
 *
 * WHY THIS HAS A `tone`
 * ──────────────────────
 * The component used to be one undifferentiated grey box reused verbatim at
 * every call site, which flattened genuinely different situations into
 * identical copy: "the platform has no bounties yet" and "you have zero open
 * pipeline items because everything you created got paid out" are both good
 * and bad news respectively, and neither deserves a call-to-action styled like
 * the other. `tone` lets a call site declare which kind of empty it is:
 *
 *   neutral  nothing exists yet, and creating something is the next step
 *   success  nothing is pending because it all completed — no CTA, no alarm
 *   info     a filter or search hid everything that does exist
 *   warning  the data is unavailable, not empty
 *
 * `title` is rendered as a real heading so screen-reader users can navigate
 * to it; it was a bare `<p>` before, which left empty states unreachable by
 * heading navigation.
 */

export type EmptyStateTone = "neutral" | "success" | "info" | "warning";

const toneClasses: Record<EmptyStateTone, { shell: string; icon: string }> = {
  neutral: {
    shell: "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40",
    icon: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
  },
  success: {
    shell: "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/5",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  info: {
    shell: "border-indigo-200 bg-indigo-50/40 dark:border-indigo-500/25 dark:bg-indigo-500/5",
    icon: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
  },
  warning: {
    shell: "border-amber-200 bg-amber-50/40 dark:border-amber-500/25 dark:bg-amber-500/5",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  tone = "neutral",
  size = "md",
  className,
  headingLevel: Heading = "h3",
  ...rest
}: {
  icon?: LucideIcon;
  title: string;
  description: React.ReactNode;
  /** Primary call to action, e.g. "Fund a bounty" or "Clear filters". */
  action?: React.ReactNode;
  /** Lower-emphasis alternative to `action`. */
  secondaryAction?: React.ReactNode;
  /** Which situation this is. See the component docblock. */
  tone?: EmptyStateTone;
  /** `sm` for list-level empties, `md` for page-level ones. */
  size?: "sm" | "md";
  className?: string;
  /**
   * Heading element. Defaults to `h3`; pass `h2` when the empty state is the
   * primary content of a page region that has no other heading, so the
   * document outline stays correct.
   */
  headingLevel?: "h2" | "h3" | "h4";
} & Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "children">) {
  const palette = toneClasses[tone];

  return (
    <div
      {...rest}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed text-center",
        size === "sm" ? "px-5 py-8" : "px-6 py-12",
        palette.shell,
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full",
            size === "sm" ? "h-9 w-9" : "h-11 w-11",
            palette.icon,
          )}
        >
          <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
        </span>
      )}
      <Heading
        className={cn(
          "font-medium text-slate-700 dark:text-slate-200",
          size === "sm" ? "mt-2 text-sm" : "mt-3 text-base",
        )}
      >
        {title}
      </Heading>
      <p
        className={cn(
          "max-w-sm text-slate-500 dark:text-slate-400",
          Icon ? "mt-1 text-sm" : "mt-2 text-sm",
        )}
      >
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
