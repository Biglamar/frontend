/**
 * @jest-environment node
 */
// Server-side (SSR / Server Component) behaviour of lib/auth: there is no
// `window`, so these must never throw during a server render.
import { clearToken, getToken, setToken } from "./auth";

describe("lib/auth on the server (no window)", () => {
  it("runs without a window global", () => {
    expect(typeof window).toBe("undefined");
  });

  it("getToken returns null via its SSR guard", () => {
    expect(getToken()).toBeNull();
  });

  it("setToken does not throw", () => {
    expect(() => setToken("jwt-abc")).not.toThrow();
  });

  it("clearToken does not throw", () => {
    expect(() => clearToken()).not.toThrow();
  });

  it("nothing leaks between calls on the server", () => {
    setToken("jwt-abc");
    expect(getToken()).toBeNull();
  });
});
