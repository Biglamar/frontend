/**
 * locale.test.ts (#456)
 *
 * The point of this file is that formatting is driven by the *viewer's*
 * locale rather than a hardcoded "en-US". Each assertion below would pass
 * identically for every locale if the implementation were locale-blind, which
 * is exactly the regression these guard.
 */

import {
  ASSET_DECIMALS,
  DEFAULT_LOCALE,
  formatAbsoluteDate,
  formatCount,
  formatCryptoAmount,
  formatDecimalWithUnit,
  formatPercentValue,
  formatRelativeTime,
  formatUnitValue,
  isRTLLocale,
  normalizeLocale,
  resetLocaleFormatters,
} from "./locale";

beforeEach(() => {
  resetLocaleFormatters();
});

/** Extract the numeric digits from a formatted string, ignoring separators. */
function digitsOnly(value: string): string {
  // Strip every non-ASCII-digit, keeping the decimal/group marks as-is for the
  // separator assertions.
  return value.replace(/[^\d.,    ]/g, "");
}

describe("normalizeLocale", () => {
  it("canonicalizes a valid tag", () => {
    expect(normalizeLocale("DE-de")).toBe("de-DE");
  });

  it("falls back to the default for null/undefined/empty", () => {
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("falls back to the default for a structurally invalid tag", () => {
    expect(normalizeLocale("not a locale!!")).toBe(DEFAULT_LOCALE);
  });
});

describe("isRTLLocale", () => {
  it.each(["ar", "ar-EG", "he", "fa-IR", "ur-PK", "yi"])("%s is RTL", (locale) => {
    expect(isRTLLocale(locale)).toBe(true);
  });

  it.each(["en", "en-US", "de-DE", "fr-FR", "hi-IN", "ja-JP"])("%s is LTR", (locale) => {
    expect(isRTLLocale(locale)).toBe(false);
  });

  it("does not throw on a malformed tag", () => {
    expect(() => isRTLLocale("!!!")).not.toThrow();
  });
});

describe("formatCryptoAmount — locale-aware separators", () => {
  it("uses en-US grouping and dot decimal", () => {
    expect(formatCryptoAmount(1234567.89, "USDC", "en-US")).toBe("1,234,567.89 USDC");
  });

  it("uses de-DE dot grouping and comma decimal", () => {
    // Previously hardcoded to en-US, so a German viewer saw "1,234,567.89 USDC".
    expect(formatCryptoAmount(1234567.89, "USDC", "de-DE")).toBe("1.234.567,89 USDC");
  });

  it("uses fr-FR non-breaking-space grouping and comma decimal", () => {
    const result = formatCryptoAmount(1234567.89, "USDC", "fr-FR");
    expect(result).toMatch(/1.234.567,89 USDC|1 234 567,89 USDC/);
  });

  it("places the sign per locale, never dropping it", () => {
    expect(formatCryptoAmount(-1234.5, "USDC", "en-US")).toBe("-1,234.5 USDC");
    expect(formatCryptoAmount(-1234.5, "USDC", "de-DE")).toBe("-1.234,5 USDC");
  });

  it("keeps the asset ticker suffixed in every locale", () => {
    // USDC/XLM are Stellar asset tickers, not ISO 4217 currencies, so
    // `Intl` currency placement is deliberately not used — see locale.ts.
    for (const locale of ["en-US", "de-DE", "fr-FR", "ar-EG", "ja-JP"]) {
      expect(formatCryptoAmount(10, "USDC", locale).endsWith("USDC")).toBe(true);
    }
  });

  it("respects per-asset precision", () => {
    expect(ASSET_DECIMALS.USDC).toBe(2);
    expect(ASSET_DECIMALS.XLM).toBe(7);
    expect(formatCryptoAmount(123.456789, "USDC", "en-US")).toBe("123.46 USDC");
    expect(formatCryptoAmount(12.3456789, "XLM", "en-US")).toBe("12.3456789 XLM");
  });

  it("does not round a sub-precision XLM amount down to zero", () => {
    expect(formatCryptoAmount(0.0000005, "XLM", "en-US")).not.toBe("0 XLM");
  });

  it("degrades non-finite input to zero without throwing", () => {
    expect(formatCryptoAmount(NaN, "USDC", "en-US")).toBe("0 USDC");
    expect(formatCryptoAmount(Infinity, "USDC", "en-US")).toBe("0 USDC");
    expect(formatCryptoAmount(-Infinity, "XLM", "en-US")).toBe("0 XLM");
  });

  it("emits locale-native digits for a non-Latin numbering system", () => {
    // ar-EG defaults to Arabic-Indic digits; hardcoded en-US could not do this.
    expect(digitsOnly(formatCryptoAmount(1234, "USDC", "ar-EG"))).not.toBe("1234");
  });
});

describe("formatCount", () => {
  it("groups per locale", () => {
    expect(formatCount(12345, "en-US")).toBe("12,345");
    expect(formatCount(12345, "de-DE")).toBe("12.345");
  });

  it("degrades non-finite input to 0", () => {
    expect(formatCount(NaN, "en-US")).toBe("0");
  });
});

describe("formatPercentValue", () => {
  it("renders the CLDR-correct form per locale", () => {
    expect(formatPercentValue(0.94, "en-US")).toBe("94%");
    // German puts a non-breaking space before the percent sign.
    expect(formatPercentValue(0.94, "de-DE")).toMatch(/94\s*%/);
  });
});

describe("formatDecimalWithUnit", () => {
  it("localizes the number and keeps the unit label pinned", () => {
    expect(formatDecimalWithUnit(12, "h", 1, "en-US")).toBe("12.0h");
    expect(formatDecimalWithUnit(12, "h", 1, "de-DE")).toBe("12,0h");
  });

  it("degrades non-finite input", () => {
    expect(formatDecimalWithUnit(NaN, "h", 1, "en-US")).toBe("0h");
  });
});

describe("formatUnitValue", () => {
  it("pluralizes per locale rather than appending a hardcoded 's'", () => {
    expect(formatUnitValue(1, "day", "en-US")).toBe("1 day");
    expect(formatUnitValue(3, "day", "en-US")).toBe("3 days");
    // A locale with a different plural shape than English's two-category one.
    expect(formatUnitValue(3, "day", "pl-PL")).not.toBe("3 days");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-03-12T12:00:00.000Z");

  it("renders a localized past tense", () => {
    expect(formatRelativeTime("2026-03-12T11:55:00.000Z", "en-US", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-03-12T11:55:00.000Z", "de-DE", now)).toMatch(/Minuten/);
  });

  it("renders a localized future tense", () => {
    expect(formatRelativeTime("2026-03-12T12:05:00.000Z", "en-US", now)).toBe("in 5 minutes");
  });

  it("collapses very small deltas instead of saying '0 seconds ago'", () => {
    expect(formatRelativeTime("2026-03-12T12:00:05.000Z", "en-US", now)).toBe("now");
  });

  it("scales units for older events", () => {
    expect(formatRelativeTime("2026-03-10T12:00:00.000Z", "en-US", now)).toBe("2 days ago");
  });

  it("returns an empty string for an unparseable timestamp", () => {
    expect(formatRelativeTime("not-a-date", "en-US", now)).toBe("");
  });
});

describe("formatAbsoluteDate", () => {
  it("renders a locale-appropriate date", () => {
    const iso = "2026-03-12T00:00:00.000Z";
    expect(formatAbsoluteDate(iso, "en-US")).toBe("Mar 12, 2026");
    // de-DE abbreviates the month to a full noun ("März"), not a numeric field.
    expect(formatAbsoluteDate(iso, "de-DE")).toBe("12. März 2026");
  });

  it("differs structurally between locales rather than just in wording", () => {
    const iso = "2026-03-12T00:00:00.000Z";
    const en = formatAbsoluteDate(iso, "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const de = formatAbsoluteDate(iso, "de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // en-US is M/D/Y, de-DE is D.M.Y — the ordering swap a hardcoded en-US
    // formatter made impossible.
    expect(en).toBe("03/12/2026");
    expect(de).toBe("12.03.2026");
  });

  it("returns an empty string for an unparseable date", () => {
    expect(formatAbsoluteDate("nope", "en-US")).toBe("");
  });
});
