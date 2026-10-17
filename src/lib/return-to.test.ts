import { sanitizeReturnTo, storeReturnTo, takeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it("accepts same-origin paths", () => {
    expect(sanitizeReturnTo("/issues/42?tab=claims#top")).toBe("/issues/42?tab=claims#top");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "issues/1",
    "/connect",
    "/auth/callback",
    "/a\nb",
    "",
    null,
  ])("rejects %p", (value) => {
    expect(sanitizeReturnTo(value as string | null)).toBeNull();
  });
});

describe("returnTo storage", () => {
  afterEach(() => window.sessionStorage.clear());

  it("round-trips once and then clears", () => {
    storeReturnTo("/issues/7");
    expect(takeReturnTo()).toBe("/issues/7");
    expect(takeReturnTo()).toBeNull();
  });

  it("does not store an unsafe value", () => {
    storeReturnTo("//evil.example");
    expect(takeReturnTo()).toBeNull();
  });
});
