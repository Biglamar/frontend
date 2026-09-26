/**
 * StatCard — headline-figure card used on all three dashboards.
 *
 * STATES
 * ──────
 * loading  → animated shimmer skeleton; never shows a value that could be
 *            mistaken for a real zero while a fetch is in flight.
 * error    → em-dash + "Error loading data" sub-label in rose tone;
 *            aria-label on the wrapper so screen readers announce the failure.
 * loaded   → value rendered, with two sub-cases:
 *   zero   → deliberate "0 …" + zeroLabel below (visually distinct from a
 *            skeleton or error so a genuine $0 balance is never ambiguous).
 *   normal → formatted value with responsive font-size scaling for large
 *            numbers; a title tooltip always exposes the full exact figure
 *            (no silent truncation of financial data).
 *
 * LARGE-NUMBER POLICY
 * ───────────────────
 * Financial figures are NOT abbreviated (no "1.2M"). Abbreviation loses
 * precision that sponsors/contributors need to see. Instead the value text
 * scales down gracefully via font-size and the full unabbreviated figure is
 * always available via the title attribute (keyboard-navigable, hover tooltip).
 */

import { cn, formatCurrency, formatInteger, formatPercent } from "@/lib/utils";
import { isRTLLocale, resolveLocale } from "@/lib/locale";
import { ArrowUpRight, ArrowDownRight, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { Card } from "./Card";

// ─── Types ──────────────────────────────────────────────────────────────────

export type StatCardStatus = "loading" | "error" | "loaded";

/** Controls how a raw numeric value is formatted inside the card. */
export type StatCardFormat = "currency" | "count" | "percent" | "raw";

export interface StatCardProps {
  label: string;
  /**
   * The data value.
   * - Pass a `number` for currency/count/percent values — the card will format
   *   it using `format` and apply responsive font scaling.
   * - Pass a pre-formatted `string` (e.g. "94%", "1.2 XLM") to skip internal
   *   formatting; large-number scaling still applies based on string length.
   * - Omit (or pass undefined) when `status` is "loading" or "error".
   */
  value?: number | string;
  /** Explicit rendering state. Defaults to "loaded". */
  status?: StatCardStatus;
  /**
   * How to format a numeric `value`. Ignored when `value` is already a string.
   * - "currency" → locale-formatted number + " USDC" (or asset via asset prop)
   * - "count"    → locale-formatted integer
   * - "percent"  → value * 100 rounded to nearest integer + "%"
   * - "raw"      → String(value), no locale formatting
   */
  format?: StatCardFormat;
  /** Currency asset label appended when format="currency". Defaults to "USDC". */
  asset?: "USDC" | "XLM";
  /** Sub-label shown beneath "0" in the zero state. Defaults to "No activity yet". */
  zeroLabel?: string;
  icon?: LucideIcon;
  trend?: number;
  sparkline?: number[];
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format a numeric value according to the requested format.
 * Returns both the display string and the full exact string for the tooltip.
 */
function formatValue(
  value: number,
  format: StatCardFormat,
  asset: "USDC" | "XLM",
  locale: string,
): { display: string; exact: string } {
  switch (format) {
    case "currency": {
      const formatted = formatCurrency(value, asset, locale);
      return { display: formatted, exact: formatted };
    }
    case "percent": {
      // Was inline `${Math.round(value * 100)}%`, a fourth hardcoded en-US
      // formatting site. Now routed through the shared locale-aware helper so
      // de-DE renders "94 %" and the sign placement follows CLDR (#456).
      const pct = formatPercent(value, locale);
      return { display: pct, exact: pct };
    }
    case "count": {
      // Was `value.toLocaleString("en-US", …)` — a second, divergent money
      // formatting path in the same component that also called
      // `formatCurrency`, so counts and currencies disagreed on separators.
      const s = formatInteger(value, locale);
      return { display: s, exact: s };
    }
    case "raw":
    default: {
      const s = String(value);
      return { display: s, exact: s };
    }
  }
}

/**
 * Return a Tailwind font-size class based on the rendered string length.
 * Shrinks gracefully for long financial figures; never truncates silently.
 *
 * Thresholds (character counts):
 *  ≤ 10 chars → text-2xl  (e.g. "42,500 USDC")
 *  ≤ 15 chars → text-xl   (e.g. "142,500 USDC")
 *  ≤ 20 chars → text-lg   (e.g. "1,234,567 USDC")
 *  > 20 chars → text-base (very large; still readable, never clipped)
 */
function valueFontClass(str: string): string {
  const len = str.length;
  if (len <= 10) return "text-2xl";
  if (len <= 15) return "text-xl";
  if (len <= 20) return "text-lg";
  return "text-base";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  status = "loaded",
  format = "raw",
  asset = "USDC",
  zeroLabel = "No activity yet",
  icon: Icon,
  trend,
  sparkline,
  className,
}: StatCardProps) {
  const trendUp = typeof trend === "number" && trend >= 0;
  // Resolved once per render and threaded into every formatter below so a card
  // cannot mix locales across its own value, trend, and sparkline (#456).
  const locale = resolveLocale();

  // ── Shared card shell ────────────────────────────────────────────────────
  const shell = (children: React.ReactNode, ariaLabel?: string) => (
    <Card
      role="region"
      aria-label={ariaLabel ?? label}
      padding="md"
      className={className}
    >
      {/* Header row: label + icon */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        {Icon && (
          <span
            data-testid="statcard-icon"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10"
          >
            <Icon aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </span>
        )}
      </div>
      {children}
    </Card>
  );

  // ── LOADING state ────────────────────────────────────────────────────────
  if (status === "loading") {
    return shell(
      <div className="mt-3 space-y-2">
        {/* Skeleton mimicking the value row height */}
        <div
          data-testid="statcard-skeleton"
          className="h-8 w-3/4 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
        />
        {/* Skeleton mimicking an optional trend row */}
        <div className="h-3.5 w-1/2 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
      </div>,
    );
  }

  // ── ERROR state ──────────────────────────────────────────────────────────
  if (status === "error") {
    return shell(
      <div className="mt-2" data-testid="statcard-error">
        <p className="text-2xl font-semibold text-slate-400 dark:text-slate-600">
          —
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-500 dark:text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Error loading data
        </p>
      </div>,
      `${label}: Error loading data`,
    );
  }

  // ── LOADED state ─────────────────────────────────────────────────────────

  // Resolve display string and exact tooltip string
  let displayStr: string;
  let exactStr: string;

  if (typeof value === "number") {
    const formatted = formatValue(value, format, asset, locale);
    displayStr = formatted.display;
    exactStr = formatted.exact;
  } else {
    // Pre-formatted string — pass through; no internal formatting applied
    displayStr = value ?? "—";
    exactStr = displayStr;
  }

  const isNumericZero = typeof value === "number" && value === 0;
  const fontClass = valueFontClass(displayStr);

  // ── Zero sub-state ───────────────────────────────────────────────────────
  if (isNumericZero) {
    return shell(
      <div className="mt-2" data-testid="statcard-zero">
        <p
          className={cn(
            "font-semibold text-slate-900 dark:text-white",
            fontClass,
          )}
          title={exactStr}
        >
          {displayStr}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {zeroLabel}
        </p>
      </div>,
    );
  }

  // ── Normal populated value ───────────────────────────────────────────────
  return shell(
    <div className="mt-2 flex items-end justify-between gap-2">
      <div>
        <p
          className={cn(
            "font-semibold text-slate-900 dark:text-white",
            fontClass,
          )}
          // Full exact figure always accessible on hover/focus — financial
          // figures must never be ambiguously abbreviated.
          title={exactStr}
          data-testid="statcard-value"
        >
          {displayStr}
        </p>
        {typeof trend === "number" && (
          <p
            className={cn(
              "mt-1 flex items-center gap-0.5 text-xs font-medium",
              trendUp
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {trendUp ? (
              <ArrowUpRight className="h-3.5 w-3.5 rtl:rotate-90" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 rtl:-rotate-90" aria-hidden="true" />
            )}
            {Math.abs(trend)}% vs last period
          </p>
        )}
      </div>
      {/* Sparkline itself renders nothing for < 2 points (can't draw a line
          through one point) — checking length here too, not just presence,
          avoids rendering an empty wrapper that leaves an unexplained gap
          in this row (#207). */}
      {sparkline && sparkline.length >= 2 && (
        <div data-testid="statcard-sparkline" className="text-indigo-500 dark:text-indigo-400">
          <Sparkline data={sparkline} mirrored={isRTLLocale(locale)} />
        </div>
      )}
    </div>,
  );
}
