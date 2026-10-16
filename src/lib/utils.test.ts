/**
 * utils.test.ts
 *
 * Tests for utility functions, with special focus on formatCurrency's
 * sign-handling behavior (issue #90).
 */

import {
  formatCurrency,
  formatDaysUntil,
  formatInteger,
  formatPercent,
  parseMoneyInput,
  coerceDecimal,
  coerceNonNegative,
  coerceFraction,
  coercePercentage,
  coerceStatus,
  validateTeamSplits,
  generateIdempotencyKey,
  toCents,
  toMajorUnits,
  sumMoney,
  subtractMoney,
} from "./utils";

// ─── formatCurrency ──────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  describe("sign preservation", () => {
    it("preserves the sign on negative amounts", () => {
      expect(formatCurrency(-50, "USDC")).toBe("-50 USDC");
      expect(formatCurrency(-150.75, "XLM")).toBe("-150.75 XLM");
      expect(formatCurrency(-1000, "USDC")).toBe("-1,000 USDC");
    });

    it("does not add a plus sign to positive amounts", () => {
      expect(formatCurrency(50, "USDC")).toBe("50 USDC");
      expect(formatCurrency(150.75, "XLM")).toBe("150.75 XLM");
    });

    it("renders zero without a sign", () => {
      expect(formatCurrency(0, "USDC")).toBe("0 USDC");
      // Note: JavaScript's -0 in toLocaleString may render as "-0" on some platforms
      const result = formatCurrency(-0, "XLM");
      expect(result === "0 XLM" || result === "-0 XLM").toBe(true);
    });

    it("distinguishes negative from positive values in the output", () => {
      const negative = formatCurrency(-50, "USDC");
      const positive = formatCurrency(50, "USDC");
      expect(negative).not.toBe(positive);
      expect(negative).toContain("-");
      expect(positive).not.toContain("-");
    });
  });

  describe("locale formatting", () => {
    it("adds thousand separators for large amounts", () => {
      expect(formatCurrency(1234567.89, "USDC")).toBe("1,234,567.89 USDC");
      expect(formatCurrency(-1234567.89, "USDC")).toBe("-1,234,567.89 USDC");
    });

    it("limits USDC to 2 decimal places", () => {
      expect(formatCurrency(123.456789, "USDC")).toBe("123.46 USDC");
    });

    it("shows up to 7 decimal places for XLM", () => {
      expect(formatCurrency(12.3456789, "XLM")).toBe("12.3456789 XLM");
      expect(formatCurrency(-12.3456789, "XLM")).toBe("-12.3456789 XLM");
    });

    it("does not display small nonzero XLM as zero", () => {
      expect(formatCurrency(0.0000005, "XLM")).not.toBe("0 XLM");
    });

    it("does not add trailing zeros for whole numbers", () => {
      expect(formatCurrency(100, "USDC")).toBe("100 USDC");
      expect(formatCurrency(100, "XLM")).toBe("100 XLM");
    });
  });

  describe("asset label", () => {
    it('defaults to "USDC" when asset is not specified', () => {
      expect(formatCurrency(42)).toBe("42 USDC");
    });

    it('appends "XLM" when specified', () => {
      expect(formatCurrency(42, "XLM")).toBe("42 XLM");
    });
  });

  describe("edge cases", () => {
    it("returns 0 for NaN", () => {
      expect(formatCurrency(NaN, "USDC")).toBe("0 USDC");
    });

    it("returns 0 for Infinity", () => {
      expect(formatCurrency(Infinity, "USDC")).toBe("0 USDC");
      expect(formatCurrency(-Infinity, "XLM")).toBe("0 XLM");
    });

    it("handles very small negative values", () => {
      expect(formatCurrency(-0.01, "USDC")).toBe("-0.01 USDC");
    });

    it("handles very large negative values", () => {
      expect(formatCurrency(-9999999.99, "USDC")).toBe("-9,999,999.99 USDC");
    });
  });
});

// ─── formatPercent ───────────────────────────────────────────────────────────

describe("formatPercent", () => {
  it("converts a fraction to a percentage", () => {
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0.94)).toBe("94%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("rounds to the nearest integer", () => {
    expect(formatPercent(0.456)).toBe("46%");
    expect(formatPercent(0.455)).toBe("46%");
  });

  it("handles zero", () => {
    expect(formatPercent(0)).toBe("0%");
  });

  it("handles NaN", () => {
    expect(formatPercent(NaN)).toBe("0%");
  });

  it("handles Infinity", () => {
    expect(formatPercent(Infinity)).toBe("0%");
  });
});

// ─── coerceDecimal ───────────────────────────────────────────────────────────

describe("coerceDecimal", () => {
  it("parses valid numeric strings", () => {
    expect(coerceDecimal("42")).toBe(42);
    expect(coerceDecimal("3.14")).toBe(3.14);
    expect(coerceDecimal("-10")).toBe(-10);
  });

  it("returns the fallback for null/undefined", () => {
    expect(coerceDecimal(null)).toBe(0);
    expect(coerceDecimal(undefined)).toBe(0);
    expect(coerceDecimal(null, 100)).toBe(100);
  });

  it("returns the fallback for non-numeric strings", () => {
    expect(coerceDecimal("abc")).toBe(0);
    expect(coerceDecimal("")).toBe(0); // Empty string coerces to 0 via Number()
  });

  it("returns the fallback for NaN", () => {
    expect(coerceDecimal("NaN")).toBe(0);
  });
});

// ─── coerceNonNegative ───────────────────────────────────────────────────────

describe("coerceNonNegative", () => {
  it("accepts positive values", () => {
    expect(coerceNonNegative("10")).toBe(10);
  });

  it("clamps negative values to the fallback", () => {
    expect(coerceNonNegative("-5")).toBe(0);
    expect(coerceNonNegative("-5", 10)).toBe(10);
  });

  it("accepts zero", () => {
    expect(coerceNonNegative("0")).toBe(0);
  });
});

// ─── coerceFraction ──────────────────────────────────────────────────────────

describe("coerceFraction", () => {
  it("accepts values in [0, 1]", () => {
    expect(coerceFraction("0")).toBe(0);
    expect(coerceFraction("0.5")).toBe(0.5);
    expect(coerceFraction("1")).toBe(1);
  });

  it("clamps values below 0 to 0", () => {
    expect(coerceFraction("-0.5")).toBe(0);
  });

  it("clamps values above 1 to 1", () => {
    expect(coerceFraction("1.5")).toBe(1);
    expect(coerceFraction("100")).toBe(1);
  });
});

// ─── coercePercentage ────────────────────────────────────────────────────────

describe("coercePercentage", () => {
  it("accepts values in [0, 100]", () => {
    expect(coercePercentage("0")).toBe(0);
    expect(coercePercentage("50")).toBe(50);
    expect(coercePercentage("100")).toBe(100);
  });

  it("clamps values below 0 to 0", () => {
    expect(coercePercentage("-10")).toBe(0);
  });

  it("clamps values above 100 to 100", () => {
    expect(coercePercentage("150")).toBe(100);
  });
});

// ─── coerceStatus ─────────────────────────────────────────────────────────

describe("coerceStatus", () => {
  it("accepts all valid BountyStatus values", () => {
    const statuses = [
      "open", "funded", "claimed", "in_review",
      "merged", "paid", "refunded", "expired",
    ] as const;
    for (const s of statuses) {
      expect(coerceStatus(s)).toBe(s);
    }
  });

  it("falls back to 'open' for an unrecognized string", () => {
    expect(coerceStatus("banana")).toBe("open");
  });

  it("falls back to 'open' for null", () => {
    expect(coerceStatus(null)).toBe("open");
  });

  it("falls back to 'open' for undefined", () => {
    expect(coerceStatus(undefined)).toBe("open");
  });

  it("falls back to 'open' for empty string", () => {
    expect(coerceStatus("")).toBe("open");
  });
});

// ─── validateTeamSplits ──────────────────────────────────────────────────────

describe("validateTeamSplits", () => {
  it("accepts splits that sum to 100%", () => {
    const result = validateTeamSplits([
      { percentage: 40 },
      { percentage: 30 },
      { percentage: 30 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.sum).toBe(100);
    expect(result.message).toBeUndefined();
  });

  it("accepts splits within tolerance (floating point)", () => {
    const result = validateTeamSplits([
      { percentage: 33.33 },
      { percentage: 33.33 },
      { percentage: 33.34 },
    ]);
    expect(result.valid).toBe(true);
  });

  it("rejects splits that do not sum to 100%", () => {
    const result = validateTeamSplits([
      { percentage: 40 },
      { percentage: 30 },
      { percentage: 20 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("90.00%");
  });

  it("handles string percentages", () => {
    const result = validateTeamSplits([
      { percentage: "50" },
      { percentage: "50" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.sum).toBe(100);
  });

  it("handles an empty array", () => {
    const result = validateTeamSplits([]);
    // Empty splits don't sum to 100, so valid=false is correct behavior
    expect(result.sum).toBe(0);
  });

  it("degrades a non-numeric percentage string to 0 instead of producing NaN (#198)", () => {
    const result = validateTeamSplits([
      { percentage: "abc" },
      { percentage: "50" },
    ]);
    expect(Number.isNaN(result.sum)).toBe(false);
    expect(result.sum).toBe(50);
    expect(result.valid).toBe(false);
    expect(result.message).not.toContain("NaN");
    expect(result.message).toContain("50.00%");
  });
});

// ─── parseMoneyInput ────────────────────────────────────────────────────────

describe("parseMoneyInput", () => {
  describe("valid inputs", () => {
    it("accepts a whole number", () => {
      const r = parseMoneyInput("100", "USDC");
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe("100");
    });

    it("accepts a decimal with valid precision for USDC", () => {
      const r = parseMoneyInput("12.50", "USDC");
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe("12.5");
    });

    it("accepts a decimal with valid precision for XLM", () => {
      const r = parseMoneyInput("12.3456789", "XLM");
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe("12.3456789");
    });

    it("normalizes trailing zeros", () => {
      const r = parseMoneyInput("1.10", "USDC");
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe("1.1");
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      const r = parseMoneyInput("", "USDC");
      expect(r.valid).toBe(false);
      expect(r.error).toBeDefined();
    });

    it("rejects zero", () => {
      const r = parseMoneyInput("0", "USDC");
      expect(r.valid).toBe(false);
      expect(r.error).toContain("greater than zero");
    });

    it("rejects negative values", () => {
      const r = parseMoneyInput("-50", "USDC");
      expect(r.valid).toBe(false);
      expect(r.error).toContain("greater than zero");
    });

    it("rejects non-numeric text", () => {
      const r = parseMoneyInput("abc", "USDC");
      expect(r.valid).toBe(false);
    });

    it("rejects Infinity", () => {
      const r = parseMoneyInput("1e500", "USDC");
      expect(r.valid).toBe(false);
    });

    it("rejects over-precision for USDC (more than 2 decimals)", () => {
      const r = parseMoneyInput("10.555", "USDC");
      expect(r.valid).toBe(false);
      expect(r.error).toContain("2 decimal places");
    });

    it("rejects over-precision for XLM (more than 7 decimals)", () => {
      const r = parseMoneyInput("1.12345678", "XLM");
      expect(r.valid).toBe(false);
      expect(r.error).toContain("7 decimal places");
    });
  });

  describe("defaults", () => {
    it("defaults to USDC when asset is omitted", () => {
      const r = parseMoneyInput("10.555");
      expect(r.valid).toBe(false);
      expect(r.error).toContain("2 decimal places");
    });
  });
});

// ─── generateIdempotencyKey ────────────────────────────────────────────────

describe("generateIdempotencyKey", () => {
  it("returns a UUID v4 string", () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generates unique keys on successive calls", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(50);
  });
});

// ─── toCents / toMajorUnits ────────────────────────────────────────────────

describe("toCents", () => {
  it("converts a USDC string to cents", () => {
    expect(toCents("12.50")).toBe(1250);
    expect(toCents("0.01")).toBe(1);
    expect(toCents("100")).toBe(10000);
  });

  it("converts an XLM string to minor units (7 decimals)", () => {
    expect(toCents("1.0000000", 7)).toBe(10000000);
    expect(toCents("0.0000001", 7)).toBe(1);
  });

  it("converts a number to cents", () => {
    expect(toCents(12.5)).toBe(1250);
    expect(toCents(0.01)).toBe(1);
  });

  it("handles whole numbers without a decimal point", () => {
    expect(toCents("100")).toBe(10000);
  });

  it("sums without float drift (#17)", () => {
    // 0.1 + 0.2 in float = 0.30000000000000004
    const a = toCents("0.1");
    const b = toCents("0.2");
    expect(a + b).toBe(30); // exact integer
    expect(toMajorUnits(a + b)).toBe(0.3);
  });
});

describe("toMajorUnits", () => {
  it("converts cents to dollars", () => {
    expect(toMajorUnits(1250)).toBe(12.5);
    expect(toMajorUnits(1)).toBe(0.01);
    expect(toMajorUnits(0)).toBe(0);
  });

  it("converts minor units back for XLM (7 decimals)", () => {
    expect(toMajorUnits(10000000, 7)).toBe(1);
    expect(toMajorUnits(1, 7)).toBe(0.0000001);
  });
});

// ─── Negative amounts + sumMoney / subtractMoney (#353) ──────────────────────

describe("toCents with negative amounts (#353)", () => {
  it("applies the sign to the whole amount", () => {
    expect(toCents("-12.50")).toBe(-1250);
    expect(toCents(-12.5)).toBe(-1250);
    expect(toCents("-0.01")).toBe(-1);
    expect(toCents("-0.0000001", 7)).toBe(-1);
  });

  it("accepts an explicit plus sign and surrounding whitespace", () => {
    expect(toCents("+12.50")).toBe(1250);
    expect(toCents(" 12.50 ")).toBe(1250);
  });

  it("round-trips negatives through toMajorUnits", () => {
    expect(toMajorUnits(toCents("-12.34"))).toBe(-12.34);
  });
});

describe("sumMoney (#353)", () => {
  it("sums without float drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(["19.99", "0.01", 5.1])).toBe(25.1);
  });

  it("returns 0 for an empty list", () => {
    expect(sumMoney([])).toBe(0);
  });

  it("respects XLM precision", () => {
    expect(sumMoney(["0.0000001", "0.0000002"], 7)).toBe(0.0000003);
    expect(sumMoney([1250.5, 8412.1234567], 7)).toBe(9662.6234567);
  });
});

describe("subtractMoney (#353)", () => {
  it("subtracts without float drift", () => {
    expect(0.3 - 0.1).not.toBe(0.2);
    expect(subtractMoney(0.3, 0.1)).toBe(0.2);
    expect(subtractMoney(24000, 15800)).toBe(8200);
  });

  it("returns a correctly signed negative result", () => {
    expect(subtractMoney("10.25", "12.50")).toBe(-2.25);
  });

  it("respects XLM precision", () => {
    expect(subtractMoney("1", "0.0000001", 7)).toBe(0.9999999);
  });
});

// ─── Locale-aware formatting (#456) ──────────────────────────────────────────
//
// Every assertion below would pass identically in every locale if the
// implementation still hardcoded "en-US". That is exactly the regression
// these guard: a de-DE or fr-FR viewer previously saw US number formatting
// everywhere, because the four call sites passed a literal "en-US".

describe("formatCurrency — follows the viewer's locale, not a hardcoded en-US", () => {
  it("uses en-US grouping when the locale is en-US", () => {
    expect(formatCurrency(1234567.89, "USDC", "en-US")).toBe("1,234,567.89 USDC");
  });

  it("uses de-DE separators when the locale is de-DE", () => {
    expect(formatCurrency(1234567.89, "USDC", "de-DE")).toBe("1.234.567,89 USDC");
    expect(formatCurrency(-1234.5, "USDC", "de-DE")).toBe("-1.234,5 USDC");
  });

  it("uses fr-FR separators when the locale is fr-FR", () => {
    expect(formatCurrency(1234.5, "USDC", "fr-FR")).toMatch(/1\u202f?234,5 USDC/);
  });

  it("keeps the sanity-ceiling warning in every locale", () => {
    expect(formatCurrency(2_000_000_000, "USDC", "en-US")).toBe("2,000,000,000 USDC ⚠");
    expect(formatCurrency(2_000_000_000, "USDC", "de-DE")).toBe("2.000.000.000 USDC ⚠");
  });

  it("does not attach the warning to a non-finite amount", () => {
    // `Math.abs(Infinity) > SANITY_CEILING` is true, so the ceiling must not be
    // evaluated before the non-finite guard.
    expect(formatCurrency(Infinity, "USDC", "en-US")).toBe("0 USDC");
    expect(formatCurrency(NaN, "XLM", "en-US")).toBe("0 XLM");
  });
});

describe("formatPercent — follows the viewer's locale", () => {
  it("renders the CLDR-correct form per locale", () => {
    expect(formatPercent(0.94, "en-US")).toBe("94%");
    // German puts a non-breaking space before the percent sign.
    expect(formatPercent(0.94, "de-DE")).toMatch(/94\s*%/);
  });

  it("still clamps out-of-range input in every locale", () => {
    expect(formatPercent(1.5, "en-US")).toBe("100%");
    expect(formatPercent(-1, "en-US")).toBe("0%");
  });
});

describe("formatDaysUntil — pluralization via Intl.PluralRules", () => {
  it("uses the singular branch for exactly one day", () => {
    expect(formatDaysUntil(1, "en")).toBe("1 day left");
  });

  it("uses the plural branch for zero and many", () => {
    expect(formatDaysUntil(0, "en")).toBe("Deadline passed");
    expect(formatDaysUntil(5, "en")).toBe("5 days left");
  });

  it("keeps the no-deadline and passed-past copy", () => {
    expect(formatDaysUntil(null, "en")).toBe("No deadline");
    expect(formatDaysUntil(-3, "en")).toBe("Deadline passed");
  });
});

describe("parseMoneyInput — accepts the viewer's own number notation (#456)", () => {
  // The old implementation round-tripped through
  // `toLocaleString("en-US").replace(/,/g, "")`, which only strips ASCII
  // commas. Under any other locale that left the locale's own separators in
  // the string and posted a corrupt amount to the backend — de-DE "12.500"
  // (three decimals), fr-FR "12 500" (a non-breaking space surviving into the
  // wire format).
  it("normalizes de-DE grouped input to the canonical dot-decimal form", () => {
    const r = parseMoneyInput("1.234,56", "USDC", "de-DE");
    expect(r).toEqual({ valid: true, normalized: "1234.56" });
  });

  it("normalizes fr-FR grouped input to the canonical dot-decimal form", () => {
    const r = parseMoneyInput("1\u202f234,56", "USDC", "fr-FR");
    expect(r).toEqual({ valid: true, normalized: "1234.56" });
  });

  it("still accepts plain dot-decimal input in a comma locale", () => {
    // <input type="number"> always produces dot-decimal per the HTML spec, so
    // a de-DE user typing into a number input must not be rejected.
    const r = parseMoneyInput("1234.56", "USDC", "de-DE");
    expect(r).toEqual({ valid: true, normalized: "1234.56" });
  });

  it("enforces the per-asset precision on locale-formatted input", () => {
    // 8 decimal places — one more than XLM allows.
    const r = parseMoneyInput("1.234,56789012", "XLM", "de-DE");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("7 decimal places");
  });

  it("reads a bare de-DE \"1.234\" as 1.234, never as 1234", () => {
    // In de-DE "." is the *group* separator, so stripping it would turn a
    // deposit of 1.234 into 1234 — a 1000x overstatement. A dot is only
    // treated as grouping when the input also carries the locale's decimal
    // mark, which is what proves the user meant the locale's notation.
    const r = parseMoneyInput("1.234", "XLM", "de-DE");
    expect(r).toEqual({ valid: true, normalized: "1.234" });
  });

  it("reads a grouped de-DE value as grouping, not as a decimal", () => {
    // With the locale's decimal mark present, the dot is unambiguously grouping.
    const r = parseMoneyInput("1.234,5", "XLM", "de-DE");
    expect(r).toEqual({ valid: true, normalized: "1234.5" });
  });

  it("rejects two decimal separators rather than guessing", () => {
    const r = parseMoneyInput("1.2.3", "USDC", "en-US");
    expect(r).toEqual({ valid: false, error: "Enter a valid number." });
  });

  it("is unchanged for en-US input", () => {
    expect(parseMoneyInput("12.50", "USDC", "en-US")).toEqual({ valid: true, normalized: "12.5" });
  });
});

describe("formatInteger", () => {
  it("groups per locale", () => {
    expect(formatInteger(12345, "en-US")).toBe("12,345");
    expect(formatInteger(12345, "de-DE")).toBe("12.345");
  });
});

