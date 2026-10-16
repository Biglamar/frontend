/**
 * Tests for validateApiUrl's scheme restriction (#204).
 *
 * new URL() alone doesn't restrict the scheme — "javascript:...",
 * "file:///...", and "ftp://..." all parse successfully despite none being
 * meaningful as an HTTP API base URL. This pins down that only http(s) is
 * accepted, and that legitimate http(s) URLs (including the default
 * fallback) still pass.
 */

import { validateApiUrl, validateStellarNetwork, EnvValidationError } from "./env";

describe("validateApiUrl — scheme restriction", () => {
  it("accepts an http URL", () => {
    expect(validateApiUrl("http://localhost:4000/api")).toBe("http://localhost:4000/api");
  });

  it("accepts an https URL", () => {
    expect(validateApiUrl("https://api.example.com")).toBe("https://api.example.com");
  });

  it("falls back to the default when unset", () => {
    expect(validateApiUrl(undefined)).toBe("http://localhost:4000/api");
  });

  it("rejects a javascript: scheme", () => {
    expect(() => validateApiUrl("javascript:alert(1)")).toThrow(EnvValidationError);
  });

  it("rejects a file: scheme", () => {
    expect(() => validateApiUrl("file:///etc/passwd")).toThrow(EnvValidationError);
  });

  it("rejects a non-http(s) network scheme like ftp:", () => {
    expect(() => validateApiUrl("ftp://example.com")).toThrow(EnvValidationError);
  });

  it("still rejects a malformed URL with the original error message", () => {
    expect(() => validateApiUrl("not-a-url")).toThrow(/is not a valid URL/);
  });
});

describe("validateStellarNetwork", () => {
  it("accepts TESTNET", () => {
    expect(validateStellarNetwork("TESTNET")).toBe("TESTNET");
  });

  it("accepts PUBLIC", () => {
    expect(validateStellarNetwork("PUBLIC")).toBe("PUBLIC");
  });

  it("rejects undefined (no default)", () => {
    expect(() => validateStellarNetwork(undefined)).toThrow(EnvValidationError);
    expect(() => validateStellarNetwork(undefined)).toThrow(/not set/);
  });

  it("rejects empty string", () => {
    expect(() => validateStellarNetwork("")).toThrow(EnvValidationError);
  });

  it("rejects case-variant MAINNET (common near-miss)", () => {
    expect(() => validateStellarNetwork("MAINNET")).toThrow(EnvValidationError);
    expect(() => validateStellarNetwork("MAINNET")).toThrow(/MAINNET/);
  });

  it("rejects lowercase public (common near-miss)", () => {
    expect(() => validateStellarNetwork("public")).toThrow(EnvValidationError);
  });

  it("rejects testnet (lowercase)", () => {
    expect(() => validateStellarNetwork("testnet")).toThrow(EnvValidationError);
  });

  it("rejects an arbitrary string", () => {
    expect(() => validateStellarNetwork("devnet")).toThrow(EnvValidationError);
  });
});
