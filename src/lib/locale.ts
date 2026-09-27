/**
 * locale.ts — locale resolution and locale-aware formatting primitives.
 *
 * SCOPE DECISION (read this first)
 * ────────────────────────────────
 * This app ships English-only copy and has no i18n runtime. Adopting
 * next-intl now would mean locale-prefixed routing (`/de/issues`), a
 * middleware rewrite, a message catalog per locale, and a second maintained
 * translation — all of which need a product decision about *which* languages
 * to support that nobody has made yet. So this module deliberately does NOT
 * do routing or translation. It does the half that is unambiguously correct
 * regardless of that decision:
 *
 *   1. Dates, numbers, percentages, relative times and crypto amounts are
 *      formatted through `Intl` driven by the *viewer's* locale, never a
 *      hardcoded "en-US". This is correct today for every user, in every
 *      locale, at zero translation cost.
 *   2. `resolveLocale()` is the single seam a future next-intl integration
 *      replaces — it is the only place a locale is decided, and every
 *      formatter below routes through it.
 *   3. `<html lang>` / `<html dir>` are set pre-hydration (see
 *      `context/LocaleContext.tsx`), and directional Tailwind classes were
 *      converted to logical properties, so an RTL locale is not a rewrite.
 *
 * What this explicitly does NOT do: translate strings, add locale URL
 * segments, or ship a second language. Hardcoded English copy lives in
 * `lib/messages.ts` behind a flat key map so a future extractor has a stable
 * target, but it is not wired to a translation runtime.
 *
 * HYDRATION SAFETY
 * ────────────────
 * The server has no `navigator`, so `resolveLocale()` returns
 * `DEFAULT_LOCALE` there. On the client it returns the viewer's locale. To
 * avoid a hydration mismatch, `LocaleContext` does NOT read the viewer's
 * locale for the first client render either — it starts at `DEFAULT_LOCALE`
 * (matching the server exactly) and upgrades in a post-mount effect. The
 * consequence is bounded and intentional: numbers are correct but formatted
 * in the default locale for at most one frame, then re-render in the real
 * locale. That is strictly better than permanently hardcoding en-US, and
 * strictly better than a hydration error.
 */

/** Locale used for SSR and for the first client render. */
export const DEFAULT_LOCALE = "en";

/** localStorage key holding a viewer's explicit locale override. */
export const LOCALE_STORAGE_KEY = "mergefi_locale";

/** Crypto assets this app denominates payouts in. */
export type CryptoAsset = "USDC" | "XLM";

/** Fraction digits per asset: USDC is an ERC-20-style 2dp token, XLM has 7. */
export const ASSET_DECIMALS: Record<CryptoAsset, number> = {
  USDC: 2,
  XLM: 7,
};

/**
 * Script direction for locales whose writing system runs right-to-left.
 *
 * `Intl.Locale.prototype.getTextInfo()` is the correct API but is still
 * shipping behind a flag in some engines, and this app supports browsers
 * where it is absent — so fall back to the language subtag list, which is
 * what every shipping i18n library does in practice.
 */
const RTL_LANGUAGE_SUBTAGS: ReadonlySet<string> = new Set([
  "ar", // Arabic
  "arc", // Aramaic
  "dv", // Divehi
  "fa", // Persian
  "he", // Hebrew
  "khw", // Khowar
  "ks", // Kashmiri
  "ps", // Pashto
  "sd", // Sindhi
  "ur", // Urdu
  "yi", // Yiddish
]);

/** True when `locale`'s writing system is right-to-left. */
export function isRTLLocale(locale: string): boolean {
  try {
    const resolved = new Intl.Locale(locale);
    const textInfo = (
      resolved as Intl.Locale & {
        getTextInfo?: () => { direction?: string };
        textInfo?: { direction?: string };
      }
    );
    const direction =
      textInfo.getTextInfo?.().direction ?? textInfo.textInfo?.direction;
    if (typeof direction === "string") return direction === "rtl";
  } catch {
    // Malformed tag — fall through to the subtag check below.
  }
  return RTL_LANGUAGE_SUBTAGS.has(locale.split("-")[0].toLowerCase());
}

/**
 * Coerce anything (`navigator.language`, an env var, a user override) into a
 * tag `Intl` will accept, falling back to {@link DEFAULT_LOCALE}.
 */
export function normalizeLocale(value: string | null | undefined): string {
  if (!value) return DEFAULT_LOCALE;
  try {
    // Throws RangeError on a structurally invalid tag.
    return Intl.getCanonicalLocales(value.trim())[0] ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * The viewer's locale, or {@link DEFAULT_LOCALE} on the server / before the
 * client has mounted. The single decision point for all locale formatting.
 */
export function resolveLocale(): string {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const override = readStoredLocale();
  if (override) return override;
  return normalizeLocale(
    navigator.languages?.[0] ?? navigator.language ?? undefined,
  );
}

function readStoredLocale(): string | null {
  // localStorage throws in Safari private browsing and when blocked by
  // cookie settings — a locale hint is never worth breaking a render over.
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persist an explicit locale override. Best-effort. */
export function storeLocale(locale: string): void {
  try {
    if (typeof window === "undefined") return;
    if (locale === DEFAULT_LOCALE) {
      window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, normalizeLocale(locale));
    }
  } catch {
    // Best-effort only.
  }
}

// ---------------------------------------------------------------------------
// Formatter cache
// ---------------------------------------------------------------------------
// `Intl.NumberFormat` construction is the single most expensive call in a
// render path. Every formatter in the app is long-lived (a handful of
// locales × a handful of option sets), so an unbounded Map keyed by
// (locale + options) is safe and keeps formatting allocation-light.

const numberFormatters = new Map<string, Intl.NumberFormat>();
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

function relativeTimeFormat(
  locale: string,
  numeric: Intl.RelativeTimeFormatNumeric,
): Intl.RelativeTimeFormat {
  const key = `${locale}|${numeric}`;
  let formatter = relativeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric });
    relativeFormatters.set(key, formatter);
  }
  return formatter;
}

function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

/** Test seam: drops every memoized formatter. */
export function resetLocaleFormatters(): void {
  numberFormatters.clear();
  relativeFormatters.clear();
  dateFormatters.clear();
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Locale-aware grouping + decimal separators for a plain number.
 *
 * USDC/XLM are deliberately NOT formatted with `style: "currency"`. They are
 * Stellar/Soroban asset tickers, not ISO 4217 currencies, so `Intl` has no
 * entry for them; borrowing a real code's placement is a lie about what the
 * unit is. In en-US, `currencyDisplay: "code"` renders "USD 1,234.56" — a
 * fiat prefix that no crypto surface uses — so this pins the ticker to a
 * suffix ("1,234.56 USDC"), which is the established convention in the app
 * and across crypto UIs. Everything numeric (grouping separators, decimal
 * separator, sign placement, digit shaping) still comes from `Intl`, so
 * `de-DE` yields "1.234,56 USDC" and `fr-FR` "1 234,56 USDC".
 */
export function formatCryptoAmount(
  value: number,
  asset: CryptoAsset = "USDC",
  locale: string = resolveLocale(),
): string {
  if (!Number.isFinite(value)) return `0 ${asset}`;
  const digits = ASSET_DECIMALS[asset];
  const formatted = numberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
  return `${formatted} ${asset}`;
}

/** Locale-aware integer/count formatting ("1,234" / "1.234"). */
export function formatCount(
  value: number,
  locale: string = resolveLocale(),
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "0";
  return numberFormat(locale, {
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

/**
 * Locale-aware percentage. Note `de-DE` renders "50 %" with a non-breaking
 * space before the sign and several locales put the sign first — both correct
 * per CLDR, and both previously impossible because this was string concat.
 */
export function formatPercentValue(
  fraction: number,
  locale: string = resolveLocale(),
  maximumFractionDigits = 0,
): string {
  if (!Number.isFinite(fraction)) return numberFormat(locale, { style: "percent" }).format(0);
  return numberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(fraction);
}

/**
 * Decimal number with a pinned "h" unit label, e.g. "12.0h" (en) / "12,0 h"
 * (de). "h" is an abbreviation rather than a translated word, so it is not
 * routed through `Intl` unit style — that would render "12 hr" / "12 Std."
 * and change the existing product copy in every locale.
 */
export function formatDecimalWithUnit(
  value: number,
  unit: string,
  fractionDigits: number,
  locale: string = resolveLocale(),
): string {
  if (!Number.isFinite(value)) return numberFormat(locale, { maximumFractionDigits: fractionDigits }).format(0) + unit;
  return `${numberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)}${unit}`;
}

/** An absolute calendar date, e.g. "12 Mar 2026" / "12.03.2026" / "2026/03/12". */
export function formatAbsoluteDate(
  iso: string | Date,
  locale: string = resolveLocale(),
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  return dateTimeFormat(locale, options).format(date);
}

const RELATIVE_UNITS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
  { unit: "second", ms: 1000 },
];

/**
 * Relative time from now, e.g. "5 minutes ago" / "vor 5 Minuten" /
 * "قبل 5 دقائق". Replaces a hand-rolled `"5m ago"` ladder that could not
 * express any language other than a compressed English abbreviation.
 */
export function formatRelativeTime(
  iso: string | Date,
  locale: string = resolveLocale(),
  now: number = Date.now(),
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  const deltaMs = date.getTime() - now;
  const absMs = Math.abs(deltaMs);
  // `numeric: "auto"` at zero renders "now" in every locale. `"always"` would
  // produce "in 0 seconds" / "vor 0 Sekunden", which reads as a bug.
  if (absMs < 45_000) return relativeTimeFormat(locale, "auto").format(0, "second");

  for (const { unit, ms } of RELATIVE_UNITS) {
    if (absMs >= ms) {
      // Truncate toward zero rather than `Math.round` on the signed value.
      // `Math.round` is half-*up*, so a negative half rounds toward positive
      // infinity: an event 90 minutes old computes to exactly -1.5 hours,
      // and a sub-millisecond clock difference makes that -1.5000001, which
      // `Math.round` turns into -2 — reporting "2 hours ago" for something
      // that happened an hour and a half ago. Truncation is symmetric for
      // past and future, matches the magnitude-only truncation this replaced,
      // and cannot produce 0 because the loop only enters a unit once the
      // delta is at least one full unit.
      const value = Math.trunc(deltaMs / ms);
      return relativeTimeFormat(locale, "auto").format(value, unit);
    }
  }
  return relativeTimeFormat(locale, "auto").format(0, "second");
}

/**
 * A counted quantity with a localized unit noun, e.g. "3 days" / "3 Tage" /
 * "٣ أيام". This is the `Intl` unit-style counterpart to
 * {@link formatCount}: it pluralizes correctly for the locale instead of
 * appending a hardcoded "s".
 *
 * The unit and unitDisplay parameters are typed as `string` rather than the
 * nominal `Intl.NumberFormatUnit` types, which are absent from the `Intl`
 * namespace in this project's `lib` configuration (TS 5 with
 * `lib: ["dom", "dom.iterable", "esnext"]`).
 */
export function formatUnitValue(
  value: number,
  unit: string,
  locale: string = resolveLocale(),
  unitDisplay: "long" | "short" | "narrow" = "long",
): string {
  if (!Number.isFinite(value)) value = 0;
  return numberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Pick the single largest-magnitude unit from a duration in milliseconds and
 * return it with its localized unit, e.g. "2 days" / "2 Tage".
 */
export function formatDuration(ms: number, locale: string = resolveLocale()): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  for (const { unit, ms: size } of RELATIVE_UNITS) {
    if (ms >= size) return formatUnitValue(Math.round(ms / size), unit, locale, "narrow");
  }
  return formatUnitValue(0, "second", locale, "narrow");
}
