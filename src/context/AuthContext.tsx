"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getToken, setToken as persistToken, clearToken, TOKEN_KEY } from "@/lib/auth";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useCrossTabStorage } from "@/hooks/useCrossTabStorage";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  /**
   * `true` while the session is still unresolved and the UI must not commit to
   * a signed-in *or* signed-out appearance.
   *
   * This covers both the initial mount hydration and any in-flight re-resolve
   * (sign-in token exchange, cross-tab login). It previously only ever went
   * `true → false` because `refresh()` never set it back, so for the whole
   * duration of the GitHub OAuth round trip the Navbar rendered its
   * logged-out CTAs — including a live "Connect GitHub" button that would
   * re-enter the very OAuth flow the user had just completed.
   */
  loading: boolean;
  login: (token: string) => Promise<AuthUser | null>;
  logout: () => void;
  /** Re-resolve the session from the persisted token. Resolves to the user, or null. */
  refresh: () => Promise<AuthUser | null>;
  /**
   * `true` when the stored token could not be exchanged for a profile because
   * the backend was unreachable, as opposed to the token being genuinely
   * invalid. Consumers must not render "signed out" for this state: the user
   * holds a valid token, they just could not be identified right now.
   */
  degraded: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);

  // `refresh()` is called from three independent places (mount hydration,
  // login, cross-tab) that can overlap. Count in-flight calls so `loading`
  // only clears once the *last* one settles — otherwise a fast cross-tab
  // refresh would flip loading false while the mount refresh was still
  // running, and the UI would briefly commit to a signed-out render.
  const inFlight = useRef(0);

  const beginResolve = useCallback(() => {
    inFlight.current += 1;
    setLoading(true);
  }, []);

  const endResolve = useCallback(() => {
    inFlight.current = Math.max(0, inFlight.current - 1);
    if (inFlight.current === 0) setLoading(false);
  }, []);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setDegraded(false);
      return null;
    }
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const session = await apiRequest<{ userId: string; username: string }>(
          "/auth/me",
        );
        const profile = await apiRequest<AuthUser>(`/users/${session.userId}`);
        setUser(profile);
        setDegraded(false);
        return profile;
      } catch (err) {
        // Only clear the token on genuine auth failures (401/403).
        // Network errors, timeouts, and transient server errors should
        // retry — silently logging the user out on a flaky connection
        // was a significant UX issue (#4).
        if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
          clearToken();
          setUser(null);
          setDegraded(false);
          return null;
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 200));
        }
      }
    }
    // All retries exhausted. The token is still valid as far as we know, but we
    // could not resolve a profile. Mark the session degraded rather than
    // letting `user === null` read as "signed out": every dashboard's
    // `if (!user)` branch renders mock data, so a transient outage would
    // otherwise present fabricated numbers as the user's own.
    setDegraded(true);
    return null;
  }, []);

  useEffect(() => {
    // Session hydration on mount: reads the JWT from localStorage and
    // resolves the current user. Deferred by a tick (#223) so it runs after
    // the initial commit instead of on the critical path to interactivity —
    // every route mounts this provider, including static marketing pages.
    const id = window.setTimeout(() => {
      beginResolve();
      void refresh().finally(endResolve);
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh, beginResolve, endResolve]);

  const handleTokenChangedElsewhere = useCallback(
    (newValue: string | null) => {
      if (newValue === null) {
        // Token cleared in another tab (logout there) — sign out here too.
        setUser(null);
        setDegraded(false);
      } else {
        // Token set/changed in another tab (login, or a different account)
        // — re-resolve whose session this now is. This raises `loading` so
        // consumers show a neutral pending state rather than the previous
        // account's chrome or a signed-out flash.
        beginResolve();
        void refresh().finally(endResolve);
      }
    },
    [refresh, beginResolve, endResolve],
  );
  useCrossTabStorage(TOKEN_KEY, handleTokenChangedElsewhere);

  const login = useCallback(
    async (token: string): Promise<AuthUser | null> => {
      persistToken(token);
      // `loading` is raised for the token exchange, not left false. Without
      // this the Navbar and ConnectPanel render their signed-out layout for
      // the whole round trip, showing a clickable "Connect GitHub" button
      // while the user is mid-sign-in (#456).
      beginResolve();
      try {
        return await refresh();
      } finally {
        endResolve();
      }
    },
    [refresh, beginResolve, endResolve],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setDegraded(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, degraded }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
