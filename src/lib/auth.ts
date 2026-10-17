export const TOKEN_KEY = "mergefi_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    // Reads are best-effort (e.g. Safari private browsing, disabled storage).
    return null;
  }
}

export function setToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Persistence is best-effort; the token still works for the current
    // in-memory session even if it can't be written to storage.
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Best-effort, same as setToken above.
  }
}

/**
 * Read the `sub` claim (the user id) out of a JWT without verifying it.
 * This is only used to skip a round trip: the backend still authenticates the
 * token on the `/users/:id` request. Returns null for anything malformed.
 */
export function getTokenSubject(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}
