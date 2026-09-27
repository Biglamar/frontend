import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BountyStatus } from "@/types";
import {
  formatCount,
  formatCryptoAmount,
  formatDecimalWithUnit,
  formatPercentValue,
  resolveLocale,
  type CryptoAsset,
} from "@/lib/locale";
import { t } from "@/lib/messages";

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

/**
 * Format a numeric amount as a currency string with the specified asset label.
 *
 * Locale-aware (#456): grouping separators, decimal separator, digit shaping
 * and sign placement all come from `Intl` via the viewer's locale, resolved
 * through {@link resolveLocale}. A `de-DE` viewer now sees "1.234,56 USDC"
 * instead of "1,234.56 USDC". The asset ticker stays suffixed — see
 * {@link formatCryptoAmount} for why (USDC/XLM are not ISO 4217 currencies, and
 * `Intl`'s en-US ISO-code placement is a fiat prefix no crypto surface uses).
 *
 * Pass an explicit `locale` to override detection — required when formatting
 * for a *specific* locale in tests, or when a future locale-routed build
 * resolves the locale from the route segment rather than the browser.
 *
 * @param amount - The numeric value to format. Negative values are preserved
 *                 and rendered with a locale-correct sign (e.g., -50 → "-50 USDC").
 * @param asset - The asset label ("USDC" or "XLM"). Defaults to "USDC".
 * @param locale - BCP-47 tag. Defaults to the viewer's locale.
 * @returns Locale-formatted currency string (e.g. en-US "1,234.56 USDC",
 *          de-DE "1.234,56 USDC"). Values above the sanity ceiling are
 *          suffixed with " ⚠" to flag implausibly large figures.
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
export function formatCurrency(
  amount: number,
  asset: CryptoAsset = "USDC",
  locale: string = resolveLocale(),
) {
  // Check non-finite *before* the sanity ceiling: `Math.abs(Infinity) > 1e9`
  // is true, so testing the ceiling first would render a non-finite amount as
  // "0 USDC ⚠" instead of the plain "0 USDC" the contract promises.
  if (!Number.isFinite(amount)) return `0 ${asset}`;
  const formatted = formatCryptoAmount(amount, asset, locale);
  if (Math.abs(amount) > SANITY_CEILING) return `${formatted} ⚠`;
  return formatted;
}

/**
 * Check whether a currency amount is within a plausible range.
 * Useful for conditionally rendering a warning badge or tooltip.
 */
export function isPlausibleAmount(amount: number): boolean {
  return Number.isFinite(amount) && Math.abs(amount) <= SANITY_CEILING;
}

/**
 * The actual group/decimal separators the viewer's locale uses, discovered
 * from `Intl` rather than assumed to be "," and ".". `de-DE` reports
 * ("\u00a0"/".") and `fr-FR` ("\u202f"/",") — a `replace(/,/g, "")` strip
 * would leave those in and post a corrupt amount to the backend.
 */
function localeSeparators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

/**
 * Validate and normalize a monetary amount string entered by a user.
 *
 * Returns a result object indicating whether the input is valid, and if so,
 * the normalized canonical decimal string suitable for sending to the backend.
 *
 * The result is always a plain dot-decimal ASCII string with no grouping
 * separators, because that is the wire format — independent of how the
 * viewer's locale happens to write the number. Input is accepted in the
 * viewer's own notation, so a `de-DE` user can type "1.234,56" and a
 * `fr-FR` user "1 234,56" and both normalize to "1234.56".
 *
 * Previously this round-tripped through `toLocaleString("en-US")` and then
 * stripped ASCII commas, which silently corrupted any input typed in a
 * locale whose separators are not "," and "." (#456).
 *
 * @param raw - The raw string from a number input.
 * @param asset - The asset type, which determines the maximum fractional precision.
 *                USDC: 2 decimals, XLM: 7 decimals.
 * @param locale - BCP-47 tag used to interpret the input notation.
 */
export function parseMoneyInput(
  raw: string,
  asset: CryptoAsset = "USDC",
  locale: string = resolveLocale(),
): { valid: boolean; normalized?: string; error?: string } {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { valid: false, error: "Enter a deposit amount." };
  }

  const { group, decimal } = localeSeparators(locale);

  // Two notations have to be accepted, and they conflict on exactly one
  // character:
  //
  //   a) the viewer's own notation  — "1.234,56" in de-DE, "1 234,56" in fr-FR
  //   b) the HTML spec              — <input type="number"> always emits a
  //                                  dot decimal, so "1234.56" in *any* locale
  //
  // They collide because "." is the *group* separator in de-DE. Naively
  // stripping the group separator turns (b)'s "1234.56" into "123456" — a
  // 1000x overstatement of a deposit amount, which is far worse than a
  // rejected input. So "." is only ever treated as grouping when the input
  // also contains the locale's own decimal mark, which is what proves the
  // user meant the locale's notation.
  let canonical: string;
  if (decimal !== "." && trimmed.includes(decimal)) {
    // (a) The locale's own notation: drop grouping, rewrite the decimal mark.
    canonical = trimmed.split(group).join("").split(decimal).join(".");
  } else {
    // (b) A dot is the decimal point. Strip the group separator only when it
    // is some other character, so a de-DE "1.234" is read as 1.234 and not 1234.
    canonical = group === "." ? trimmed : trimmed.split(group).join("");
  }

  // Two decimal points is malformed rather than a number, in any notation.
  if ((canonical.match(/\./g) ?? []).length > 1) {
    return { valid: false, error: "Enter a valid number." };
  }

  const num = Number(canonical);

  if (!Number.isFinite(num)) {
    return { valid: false, error: "Enter a valid number." };
  }

  if (num <= 0) {
    return { valid: false, error: "Amount must be greater than zero." };
  }

  const maxDecimals = asset === "XLM" ? 7 : 2;
  const decimalPart = canonical.includes(".") ? canonical.split(".")[1] : "";

  if (decimalPart.length > maxDecimals) {
    return {
      valid: false,
      error: `${asset} supports up to ${maxDecimals} decimal places.`,
    };
  }

  // Normalize to the canonical dot-decimal wire form, dropping any trailing
  // zeros the viewer's locale added ("12,50" → "12.5"). `toFixed` is the
  // correct primitive here precisely because it is locale-independent.
  const normalized = num.toFixed(maxDecimals).replace(/\.?0+$/, "");

  return { valid: true, normalized: normalized === "" ? "0" : normalized };
}

/**
 * Format a fraction (0–1) as a rounded percentage string.
 *
 * Clamps the input to [0, 1] before converting, matching the defensive
 * pattern established by {@link formatCurrency}'s SANITY_CEILING.
 * Values outside this range are almost certainly data bugs (see #91).
 *
 * Locale-aware (#456): `de-DE` renders "50 %" with a non-breaking space and
 * several locales lead with the sign, both per CLDR.
 */
export function formatPercent(value: number, locale: string = resolveLocale()) {
  if (!Number.isFinite(value)) return formatPercentValue(0, locale);
  const clamped = Math.min(1, Math.max(0, value));
  return formatPercentValue(clamped, locale);
}

/**
 * Format a numeric hour value with one decimal place and an "h" suffix.
 * Used for avgReviewTimeHours and similar duration metrics (#437).
 *
 * The number is locale-formatted ("12,0h" in de-DE, "12.0h" in en-US); the
 * "h" label is pinned because it is an abbreviation, not a translatable word.
 */
export function formatHours(value: number, locale: string = resolveLocale()) {
  return formatDecimalWithUnit(value, "h", 1, locale);
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

/**
 * Human deadline label. Pluralization goes through `Intl.PluralRules` via the
 * message catalog rather than the previous `days === 1 ? "" : "s"` ternary,
 * which is only correct for English (Slovak has four plural categories,
 * Arabic six) — (#456).
 */
export function formatDaysUntil(days: number | null, locale: string = resolveLocale()): string {
  if (days === null) return t("deadline.none", {}, locale);
  if (days > 0) return t("deadline.left", { count: days }, locale);
  return t("deadline.passed", {}, locale);
}

/** Locale-aware integer/count string ("1,234" in en-US, "1.234" in de-DE). */
export function formatInteger(value: number, locale: string = resolveLocale()): string {
  return formatCount(value, locale);
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
  const raw = (typeof value === "number" ? value.toFixed(decimals) : String(value)).trim();
  // Apply the sign to the whole amount: "-12.50" is -1250, not -1200 + 50 (#353).
  const negative = raw.startsWith("-");
  const str = negative || raw.startsWith("+") ? raw.slice(1) : raw;
  const [whole = "0", frac = ""] = str.split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  const cents = parseInt(whole || "0", 10) * 10 ** decimals + parseInt(padded || "0", 10);
  return negative ? -cents : cents;
}

/**
 * Convert integer minor units back to a major-unit float for display.
 * 1250 → 12.5 (for USDC with 2 decimals).
 */
export function toMajorUnits(cents: number, decimals = 2): number {
  return cents / 10 ** decimals;
}

/**
 * Sum monetary amounts without float drift by adding integer minor units
 * (#353). `sumMoney([0.1, 0.2])` is exactly 0.3, unlike `0.1 + 0.2`.
 */
export function sumMoney(values: ReadonlyArray<string | number>, decimals = 2): number {
  const cents = values.reduce<number>((total, value) => total + toCents(value, decimals), 0);
  return toMajorUnits(cents, decimals);
}

/**
 * Subtract monetary amounts (`a - b`) via integer minor units (#353), e.g. a
 * total spent derived from total funded minus budget remaining.
 */
export function subtractMoney(a: string | number, b: string | number, decimals = 2): number {
  return toMajorUnits(toCents(a, decimals) - toCents(b, decimals), decimals);
}
