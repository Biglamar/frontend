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
