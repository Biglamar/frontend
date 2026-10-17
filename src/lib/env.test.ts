/**
 * Tests for validateApiUrl's scheme restriction (#204) and its
 * normalization/https-on-PUBLIC rules (#683).
 *
 * new URL() alone doesn't restrict the scheme — "javascript:...",
 * "file:///...", and "ftp://..." all parse successfully despite none being
 * meaningful as an HTTP API base URL. This pins down that only http(s) is
 * accepted, that legitimate http(s) URLs (including the default fallback)
 * still pass, that trailing slashes are stripped so composed request paths
 * never contain "//", and that a PUBLIC-network build rejects a plain
 * http: URL except on loopback.
 */

import { validateApiUrl, validateStellarNetwork, EnvValidationError } from "./env";

describe("validateApiUrl — scheme restriction", () => {
  it("accepts an http URL on TESTNET", () => {
    expect(validateApiUrl("http://localhost:4000/api", "TESTNET")).toBe(
      "http://localhost:4000/api",
    );
  });

  it("accepts an https URL", () => {
    expect(validateApiUrl("https://api.example.com", "TESTNET")).toBe("https://api.example.com");
  });

  it("accepts an https URL on PUBLIC", () => {
    expect(validateApiUrl("https://api.example.com", "PUBLIC")).toBe("https://api.example.com");
  });

  it("falls back to the default when unset", () => {
    expect(validateApiUrl(undefined, "TESTNET")).toBe("http://localhost:4000/api");
  });

  it("falls back to the default when unset, even on PUBLIC (loopback is exempt)", () => {
    expect(validateApiUrl(undefined, "PUBLIC")).toBe("http://localhost:4000/api");
  });

  it("rejects a javascript: scheme", () => {
    expect(() => validateApiUrl("javascript:alert(1)", "TESTNET")).toThrow(EnvValidationError);
  });

  it("rejects a file: scheme", () => {
    expect(() => validateApiUrl("file:///etc/passwd", "TESTNET")).toThrow(EnvValidationError);
  });

  it("rejects a non-http(s) network scheme like ftp:", () => {
    expect(() => validateApiUrl("ftp://example.com", "TESTNET")).toThrow(EnvValidationError);
  });

  it("still rejects a malformed URL with the original error message", () => {
    expect(() => validateApiUrl("not-a-url", "TESTNET")).toThrow(/is not a valid URL/);
  });
});

describe("validateApiUrl — trailing-slash normalization (#683)", () => {
  it("strips a single trailing slash", () => {
    expect(validateApiUrl("https://api.example.com/api/", "TESTNET")).toBe(
      "https://api.example.com/api",
    );
  });

  it("strips multiple trailing slashes", () => {
    expect(validateApiUrl("https://api.example.com/api///", "PUBLIC")).toBe(
      "https://api.example.com/api",
    );
  });

  it("strips the trailing slash on a bare origin", () => {
    expect(validateApiUrl("https://api.example.com/", "TESTNET")).toBe("https://api.example.com");
  });

  it("leaves a URL without a trailing slash unchanged", () => {
    expect(validateApiUrl("https://api.example.com/api", "TESTNET")).toBe(
      "https://api.example.com/api",
    );
  });

  it("keeps a localhost http default without a trailing slash", () => {
    expect(validateApiUrl("http://localhost:4000/api/", "TESTNET")).toBe(
      "http://localhost:4000/api",
    );
  });
});

describe("validateApiUrl — https required on PUBLIC (#683)", () => {
  it("rejects a plain http URL when the network is PUBLIC", () => {
    expect(() => validateApiUrl("http://api.example.com/api", "PUBLIC")).toThrow(
      EnvValidationError,
    );
    expect(() => validateApiUrl("http://api.example.com/api", "PUBLIC")).toThrow(
      /must talk to the API over "https:"/,
    );
  });

  it("accepts a plain http URL when the network is TESTNET", () => {
    expect(validateApiUrl("http://api.example.com/api", "TESTNET")).toBe(
      "http://api.example.com/api",
    );
  });

  it("allows http on PUBLIC for localhost", () => {
    expect(validateApiUrl("http://localhost:4000/api", "PUBLIC")).toBe(
      "http://localhost:4000/api",
    );
  });

  it("allows http on PUBLIC for 127.0.0.1", () => {
    expect(validateApiUrl("http://127.0.0.1:4000/api", "PUBLIC")).toBe(
      "http://127.0.0.1:4000/api",
    );
  });

  it("allows http on PUBLIC for ::1", () => {
    expect(validateApiUrl("http://[::1]:4000/api", "PUBLIC")).toBe("http://[::1]:4000/api");
  });

  it("does not treat a non-loopback host that merely contains 'localhost' as loopback", () => {
    expect(() => validateApiUrl("http://localhost.example.com/api", "PUBLIC")).toThrow(
      EnvValidationError,
    );
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
