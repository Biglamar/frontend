/**
 * DataSourceNotice — the "this isn't real data" signal.
 *
 * WHY THIS IS COMPONENTS-PURE
 * ───────────────────────────
 * The amber "Sample data" chip was copy-pasted into six places in the two
 * client dashboards plus the server-rendered maintainer dashboard, and
 * /issues, /milestones, /issues/[id] and /reputation/[handle] rendered a
 * mock fallback with no indicator at all. A visitor whose backend was down had
 * no way to tell fabricated numbers from their own on four of the six data
 * surfaces.
 *
 * WHY IT IS ALSO NOT AN EMPTY STATE
 * ────────────────────────────────
 * These are independent signals and both can be true at once: a backend outage
 * whose fallback list happens to be empty is simultaneously "there is nothing
 * here" and "we could not reach the server". Rendering only one of them is
 * misleading in both directions — an empty state alone implies the platform
 * really has no bounties, and a notice alone leaves the visitor staring at a
 * blank region with no explanation. So `EmptyState` and `DataSourceNotice`
 * compose as siblings, and callers that have both render both.
 */

import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { messages } from "@/lib/messages";

/** Compact inline chip, for labelling a specific section. */
export function SampleDataChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      {messages["data.sample"]}
    </span>
  );
}

/** Prominent banner explaining that everything below is illustrative. */
export function DataSourceNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-medium">{messages["data.sample"]}.</span>{" "}
        {messages["data.sampleExplainer"]}
      </p>
    </div>
  );
}
