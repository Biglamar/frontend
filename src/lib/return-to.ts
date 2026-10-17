const RETURN_TO_KEY = "mergefi_return_to";

/**
 * Validate a post-sign-in destination. Only same-origin absolute paths are
 * accepted (no scheme, no `//host`, no backslash tricks, no control chars), so
 * a crafted `?returnTo=` can't turn the sign-in flow into an open redirect.
 * Sign-in pages themselves are rejected to avoid redirect loops.
 */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value || value.length > 2048) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (/^\/(connect|auth)(\/|\?|#|$)/.test(value)) return null;
  return value;
}

/** Remember the destination across the cross-origin GitHub OAuth round trip. */
export function storeReturnTo(value: string | null | undefined) {
  const safe = sanitizeReturnTo(value);
  try {
    if (safe) window.sessionStorage.setItem(RETURN_TO_KEY, safe);
    else window.sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    // Best-effort (storage can throw in private modes): sign-in still works.
  }
}

/** Read and clear the remembered destination, re-validating it. */
export function takeReturnTo(): string | null {
  try {
    const value = window.sessionStorage.getItem(RETURN_TO_KEY);
    window.sessionStorage.removeItem(RETURN_TO_KEY);
    return sanitizeReturnTo(value);
  } catch {
    return null;
  }
}
