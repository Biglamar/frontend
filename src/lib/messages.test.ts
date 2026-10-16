/**
 * messages.test.ts (#456)
 *
 * The catalog exists so a future translation pass is a mechanical `t("key")`
 * swap rather than a rewrite of 80 components. That only holds if the resolver
 * actually does what a real i18n runtime does — which is what these assert,
 * especially the ICU plural resolution that replaced a hardcoded
 * `days === 1 ? "" : "s"` ternary.
 */

import { messages, pluralCategory, t, type MessageKey } from "./messages";

describe("t — interpolation", () => {
  it("substitutes named placeholders", () => {
    expect(t("connect.github.signedIn", { username: "ana" })).toBe("Signed in as @ana");
  });

  it("substitutes numeric values", () => {
    expect(t("empty.issues.filtered.description", { total: 12 })).toContain("all 12 available");
  });

  it("leaves unknown placeholders untouched rather than printing undefined", () => {
    expect(t("connect.github.signedIn")).toBe("Signed in as @{username}");
  });

  it("returns the raw message when no values are supplied", () => {
    expect(t("empty.activity.title")).toBe(messages["empty.activity.title"]);
  });
});

describe("t — ICU plural resolution", () => {
  it("selects the 'one' branch for exactly one", () => {
    expect(t("deadline.left", { count: 1 }, "en")).toBe("1 day left");
  });

  it("selects the 'other' branch for zero", () => {
    expect(t("deadline.left", { count: 0 }, "en")).toBe("0 days left");
  });

  it("selects the 'other' branch for many", () => {
    expect(t("deadline.left", { count: 5 }, "en")).toBe("5 days left");
  });

  it("substitutes # with the count inside the chosen branch", () => {
    expect(t("deadline.left", { count: 3 }, "en")).toContain("3 days");
  });

  it("uses a different plural category shape for a non-English locale", () => {
    // The defect this replaces: a `days === 1 ? "" : "s"` ternary is only valid
    // for English. Polish has a separate "few" category, so the count of 3 is
    // not covered by the two-branch template.
    expect(pluralCategory(3, "pl-PL")).toBe("few");
    expect(pluralCategory(1, "en-US")).toBe("one");
    expect(pluralCategory(2, "en-US")).toBe("other");
  });

  it("falls back to the 'other' branch for a locale with no matching category", () => {
    // Slovak has four categories; a template that only defines one/other must
    // degrade to 'other' rather than rendering an empty string.
    expect(t("deadline.left", { count: 2 }, "sk-SK")).toBe("2 days left");
  });
});

describe("catalog integrity", () => {
  it("has no empty message values", () => {
    for (const [key, value] of Object.entries(messages)) {
      expect(typeof value).toBe("string");
      expect(value.trim().length).toBeGreaterThan(0);
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it("only uses placeholders that ICU plural can resolve", () => {
    // A stray `{` in a message would break the plural parser's brace counting.
    for (const [key, value] of Object.entries(messages)) {
      const opens = (value.match(/\{/g) ?? []).length;
      const closes = (value.match(/\}/g) ?? []).length;
      expect({ key, opens, closes }).toEqual({ key, opens: closes, closes: opens });
    }
  });

  it("resolves every key through t() without throwing", () => {
    for (const key of Object.keys(messages) as MessageKey[]) {
      expect(() => t(key, { count: 2, username: "x", total: 1, address: "a", onFile: "b", network: "n" })).not.toThrow();
    }
  });
});
