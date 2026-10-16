import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BountyStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function coerceDecimal(value: string | null | undefined, fallback = 0): number {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export function coerceNonNegative(value: string | null | undefined, fallback = 0): number {
  const n = coerceDecimal(value, fallback);
  return n < 0 ? fallback : n;
}

export function coerceFraction(value: string | null | undefined, fallback = 0): number {
  const n = coerceDecimal(value, fallback);
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function coercePercentage(value: string | null | undefined, fallback = 0): number {
  const n = coerceDecimal(value, fallback);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/**
 * Soft ceiling for currency display. Values above this are likely corrupted,
 * misconfigured (e.g. sent in base units instead of whole units), or a
 * backend data-entry error. formatCurrency appends a warning indicator.
 */
const SANITY_CEILING = 1_000_000_000; // 1 billion

// ── Cached Intl.NumberFormat instances (#656) ────────────────────────────────
// `Intl.NumberFormat` construction calls `resolveLocale()` which is expensive
// and can vary between server and client (hydration mismatch). Cache instances
// so they're constructed once and reused deterministically across renders.
const numberFormats = new Map<string, Intl.NumberFormat>();

/**
 * Cached Intl.NumberFormat factory. Returns a memoized formatter for the
 * given locale + options, avoiding repeated `resolveLocale()` calls (#656).
 */
export function getNumberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let fmt = numberFormats.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, fmt);
  }
  return fmt;
}

// ── Locale-independent formatting (#656) ──────────────────────────────────────
// Use explicit "en-US" locale so server and client always produce identical
// output regardless of the viewer's system locale.

const currencyFormat2 = getNumberFormat("en-US", { maximumFractionDigits: 2 });
const currencyFormat7 = getNumberFormat("en-US", { maximumFractionDigits: 7 });
const countFormat = getNumberFormat("en-US", { maximumFractionDigits: 0 });
const parseNormalizeFormat2 = getNumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const parseNormalizeFormat7 = getNumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 7 });

/**
 * Format a numeric amount as a currency string with the specified asset label.
 *
 * @param amount - The numeric value to format. Negative values are preserved
 *                 and rendered with a leading minus sign (e.g., -50 → "-50 USDC").
 * @param asset - The asset label to append ("USDC" or "XLM"). Defaults to "USDC".
 * @returns Locale-formatted currency string (e.g., "1,234.56 USDC", "-50 XLM").
 *          Values above the sanity ceiling are suffixed with " ⚠" to flag
 *          implausibly large figures that may indicate corrupted data.
 *
 * @remarks
 * This function deliberately preserves the sign of negative amounts rather than
 * silently discarding it via Math.abs(). Financial systems may legitimately
 * display negative figures for:
 * - Net-negative sponsor balances (refunds exceeding deposits)
 * - Accounting corrections or adjustments
 * - Deltas or changes (e.g., budget remaining after overspending)
 *
 * This behavior matches StatCard's internal currency formatter, ensuring
 * consistency across the app. StatCard's currency format uses this function
 * directly.
 */
export function formatCurrency(amount: number, asset: "USDC" | "XLM" = "USDC") {
  if (!Number.isFinite(amount)) return `0 ${asset}`;
  const fmt = asset === "XLM" ? currencyFormat7 : currencyFormat2;
  const formatted = fmt.format(amount);
  if (Math.abs(amount) > SANITY_CEILING) return `${formatted} ${asset} ⚠`;
  return `${formatted} ${asset}`;
}

/**
 * Check whether a currency amount is within a plausible range.
 * Useful for conditionally rendering a warning badge or tooltip.
 */
export function isPlausibleAmount(amount: number): boolean {
  return Number.isFinite(amount) && Math.abs(amount) <= SANITY_CEILING;
}

/**
 * Validate and normalize a monetary amount string entered by a user.
 *
 * Returns a result object indicating whether the input is valid, and if so,
 * the normalized canonical decimal string suitable for sending to the backend.
 *
 * @param raw - The raw string from a number input.
 * @param asset - The asset type, which determines the maximum fractional precision.
 *                USDC: 2 decimals, XLM: 7 decimals.
 */
export function parseMoneyInput(
  raw: string,
  asset: "USDC" | "XLM" = "USDC",
): { valid: boolean; normalized?: string; error?: string } {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { valid: false, error: "Enter a deposit amount." };
  }

  const num = Number(trimmed);

  if (!Number.isFinite(num)) {
    return { valid: false, error: "Enter a valid number." };
  }

  if (num <= 0) {
    return { valid: false, error: "Amount must be greater than zero." };
  }

  const maxDecimals = asset === "XLM" ? 7 : 2;
  const decimalPart = trimmed.includes(".") ? trimmed.split(".")[1] : "";

  if (decimalPart.length > maxDecimals) {
    return {
      valid: false,
      error: `${asset} supports up to ${maxDecimals} decimal places.`,
    };
  }

  // Normalize: convert to a canonical decimal string with the right precision.
  // Use a cached Intl.NumberFormat with fixed fraction digits to get a clean
  // representation, then strip thousands separators.
  const fmt = asset === "XLM" ? parseNormalizeFormat7 : parseNormalizeFormat2;
  const normalized = fmt.format(num).replace(/,/g, "");

  return { valid: true, normalized };
}

/**
 * Format a fraction (0–1) as a rounded percentage string.
 *
 * Clamps the input to [0, 1] before converting, matching the defensive
 * pattern established by {@link formatCurrency}'s SANITY_CEILING.
 * Values outside this range are almost certainly data bugs (see #91).
 */
export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  const clamped = Math.min(1, Math.max(0, value));
  return `${Math.round(clamped * 100)}%`;
}

/**
 * Format a numeric hour value with one decimal place and an "h" suffix.
 * Used for avgReviewTimeHours and similar duration metrics (#437).
 */
export function formatHours(value: number) {
  if (!Number.isFinite(value)) return "0h";
  return `${value.toFixed(1)}h`;
}

/**
 * DST-safe calendar-day difference between a deadline and now.
 * Uses UTC date arithmetic (not wall-clock ms division) so results are
 * consistent regardless of the viewer's timezone or DST state.
 */
export function daysUntil(dateIso: string) {
  const deadline = new Date(dateIso);
  const now = new Date();
  // Compare UTC calendar dates to avoid DST/off-by-one issues
  const deadlineUtc = Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate());
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((deadlineUtc - nowUtc) / (1000 * 60 * 60 * 24));
}

export function formatDaysUntil(days: number | null): string {
  if (days === null) return "No deadline";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} left`;
  return "Deadline passed";
}

const VALID_STATUSES: ReadonlySet<string> = new Set<BountyStatus>([
  "open",
  "funded",
  "claimed",
  "in_review",
  "merged",
  "paid",
  "refunded",
  "expired",
]);

/**
 * Validate that a raw status string is a known BountyStatus. Returns the
 * validated status or falls back to "open" for unrecognized values (#279).
 */
export function coerceStatus(value: string | null | undefined): BountyStatus {
  if (value && VALID_STATUSES.has(value)) return value as BountyStatus;
  return "open";
}

export function validateTeamSplits(
  splits: Array<{ percentage: string | number }>,
  tolerance = 0.01
): { valid: boolean; sum: number; message?: string } {
  if (!splits || splits.length === 0) return { valid: true, sum: 0 };
  // coerceDecimal degrades a malformed percentage string to 0 instead of
  // NaN, so one bad split can't poison the whole sum into "NaN%" (#198).
  const percentages = splits.map((s) =>
    typeof s.percentage === "string" ? coerceDecimal(s.percentage) : s.percentage
  );
  const sum = percentages.reduce((a, b) => a + b, 0);
  const valid = Math.abs(sum - 100) <= tolerance;
  return {
    valid,
    sum,
    message: valid ? undefined : `Team splits sum to ${sum.toFixed(2)}% (expected 100%)`,
  };
}

// ---------------------------------------------------------------------------
// Idempotency key generation (#6)
// ---------------------------------------------------------------------------

/**
 * Generate a v4 UUID for use as an idempotency key on financial API calls.
 * The backend should deduplicate requests with the same key, preventing
 * double-submission when the user retries after a network blip or Freighter
 * popup timeout.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (very unlikely in
  // modern browsers, but defensive).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// Decimal-safe financial arithmetic (#17)
// ---------------------------------------------------------------------------

/**
 * Convert a monetary string (e.g. "12.50") to integer minor units (cents).
 * USDC has 2 decimal places → "12.50" → 1250.
 * XLM has 7 decimal places → "1.0000000" → 10000000.
 *
 * This avoids IEEE-754 float drift when summing many amounts — integers
 * don't have representation gaps in the ranges we care about.
 */
export function toCents(value: string | number, decimals = 2): number {
  const str = typeof value === "number" ? value.toFixed(decimals) : String(value);
  const [whole = "0", frac = ""] = str.split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  return parseInt(whole, 10) * 10 ** decimals + parseInt(padded || "0", 10);
}

/**
 * Convert integer minor units back to a major-unit float for display.
 * 1250 → 12.5 (for USDC with 2 decimals).
 */
export function toMajorUnits(cents: number, decimals = 2): number {
  return cents / 10 ** decimals;
}
