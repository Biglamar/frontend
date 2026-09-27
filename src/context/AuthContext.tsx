"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getToken, setToken as persistToken, clearToken, TOKEN_KEY } from "@/lib/auth";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useCrossTabStorage } from "@/hooks/useCrossTabStorage";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (token: string) => Promise<AuthUser | null>;
  logout: () => void;
  // Resolves with the session's user (null when there's no valid token, after
  // a 401/403, or when all retries are exhausted) — CallbackClient awaits
  // login() and redirects on the *resolved* user, so this must not be
  // Promise<void> or the role-based redirect silently degrades to the
  // contributor fallback.
  refresh: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
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
        setLoading(false);
        return profile;
      } catch (err) {
        // Only clear the token on genuine auth failures (401/403).
        // Network errors, timeouts, and transient server errors should
        // retry — silently logging the user out on a flaky connection
        // was a significant UX issue (#4).
        if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
          clearToken();
          setUser(null);
          setLoading(false);
          return null;
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 200));
        }
      }
    }
    // All retries exhausted — keep the existing session alive rather than
    // logging the user out on repeated network failures. The next
    // navigation or cross-tab event will re-trigger refresh.
    setLoading(false);
    return null;
  }, []);

  useEffect(() => {
    // Session hydration on mount: reads the JWT from localStorage and
    // resolves the current user. Deferred by a tick (#223) so it runs after
    // the initial commit instead of on the critical path to interactivity —
    // every route mounts this provider, including static marketing pages.
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const handleTokenChangedElsewhere = useCallback(
    (newValue: string | null) => {
      if (newValue === null) {
        // Token cleared in another tab (logout there) — sign out here too.
        setUser(null);
        setLoading(false);
      } else {
        // Token set/changed in another tab (login, or a different account)
        // — re-resolve whose session this now is.
        void refresh();
      }
    },
    [refresh],
  );
  useCrossTabStorage(TOKEN_KEY, handleTokenChangedElsewhere);

  const login = useCallback(
    async (token: string): Promise<AuthUser | null> => {
      persistToken(token);
      return refresh();
    },
    [refresh],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
