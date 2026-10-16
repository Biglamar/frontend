import { cn } from "@/lib/utils";

/**
 * DataSourceNotice — inline badge indicating whether data is live or from
 * a mock/fallback source.
 *
 * Used across dashboards and detail pages so users always know when they're
 * looking at sample data vs live backend data. Wraps the repeated
 * "Sample data" / "Mock Data" inline pattern that was previously duplicated
 * in each page.
 */
export interface DataSourceNoticeProps {
  /** The data source. "live" renders nothing (no noise when data is real). */
  source: "live" | "mock";
  /** Visual variant: "badge" is a small pill, "inline" is plain text. */
  variant?: "badge" | "inline";
  /** Override the label text. Defaults to "Sample data". */
  label?: string;
  className?: string;
}

export function DataSourceNotice({
  source,
  variant = "badge",
  label = "Sample data",
  className,
}: DataSourceNoticeProps) {
  if (source === "live") return null;

  if (variant === "inline") {
    return (
      <span
        className={cn("text-xs text-amber-600 dark:text-amber-400", className)}
        role="status"
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
        className,
      )}
      role="status"
    >
      {label}
    </span>
  );
}
