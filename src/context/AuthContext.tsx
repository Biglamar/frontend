"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getToken, setToken as persistToken, clearToken, TOKEN_KEY } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { useCrossTabStorage } from "@/hooks/useCrossTabStorage";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** True when the auth backend is unreachable and the session state is uncertain (#587) */
  degraded: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      setDegraded(false);
      return;
    }
    try {
      const session = await apiRequest<{ userId: string; username: string }>(
        "/auth/me",
      );
      const profile = await apiRequest<AuthUser>(`/users/${session.userId}`);
      setUser(profile);
      setDegraded(false);
    } catch {
      clearToken();
      setUser(null);
      setDegraded(true);
    } finally {
      setLoading(false);
    }
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
    async (token: string) => {
      persistToken(token);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, degraded, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
