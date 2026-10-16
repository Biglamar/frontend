import { Inbox } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/locale";
import { t } from "@/lib/messages";
import type { ActivityEvent } from "@/lib/mock-data";

/**
 * Relative time comes from `Intl.RelativeTimeFormat` via the viewer's locale
 * (#456). The previous hand-rolled ladder produced only English abbreviations
 * ("5m ago", "3h ago", "2d ago") — grammatically wrong in most languages and
 * not translatable at all, since "m"/"h"/"d" are ambiguous across locales
 * (de-DE uses "Min."/"Std."/"T.", fr-FR "min"/"h"/"j").
 */
function timeAgo(occurredAt: string) {
  return formatRelativeTime(occurredAt);
}

export function ActivityList({ events }: { events: ActivityEvent[] }) {
  // An empty list used to render the bordered card with zero rows inside it —
  // a visible empty box with no explanation. It is the only feed shared by all
  // three dashboards and the marketing home page, so this was the most
  // prominent missing empty state in the app.
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        tone="neutral"
        size="sm"
        title={t("empty.activity.title")}
        description={t("empty.activity.description")}
      />
    );
  }

  return (
    <ul role="list" className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {events.map((event) => (
        <li key={event.id} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar seed={event.handle} size={32} />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-900 dark:text-white">{event.handle}</span>{" "}
              {event.action}{" "}
              <span className="font-medium text-slate-900 dark:text-white">{event.target}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            {/* `event.amount && (...)` would render a bare "0" text node for
                a genuine amount: 0 event, since `0 && x` evaluates to `0`
                itself, not `false` — React renders that. Guard on presence/
                type instead, matching StatCard's trend rendering (#87). A
                codebase-wide grep for the same bare-truthiness-on-a-number
                pattern found no other occurrences. */}
            {typeof event.amount === "number" && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(event.amount, event.asset)}
              </span>
            )}
            <time dateTime={event.occurredAt}>{timeAgo(event.occurredAt)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}
