"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { takeReturnTo } from "@/lib/return-to";
import type { UserRole } from "@/types";

const ROLE_REDIRECT_MAP: Record<UserRole, string> = {
  maintainer: "/dashboard/maintainer",
  sponsor: "/dashboard/sponsor",
  contributor: "/dashboard/contributor",
};

/** Multi-role precedence for the *landing* page only. */
const ROLE_PRECEDENCE: readonly UserRole[] = ["maintainer", "sponsor", "contributor"];

/**
 * Where to land after sign-in.
 *
 * MULTI-ROLE (#456): `AuthUser.roles` is an array, and a maintainer who also
 * sponsors legitimately holds two. Collapsing that to a single dashboard on
 * arrival would hide one of their roles behind a URL they have to know, so
 * only the *landing* page uses this precedence — and the Navbar's dashboard
 * menu lists every role the account actually holds. A multi-role user is
 * therefore never locked out of a dashboard they are entitled to.
 *
 * A user with no roles assigned yet lands on the contributor dashboard, which
 * renders in demo mode with a "Demo data" badge rather than an error.
 */
function redirectForRoles(roles: UserRole[] | undefined): string {
  if (!roles || roles.length === 0) return ROLE_REDIRECT_MAP.contributor;
  for (const role of ROLE_PRECEDENCE) {
    if (roles.includes(role)) return ROLE_REDIRECT_MAP[role];
  }
  return ROLE_REDIRECT_MAP.contributor;
}

/**
 * Wallet linking is server-side keyed to the authenticated user, so a session
 * that completes with no `stellarAddress` still has an unfinished setup step.
 * `/connect` is the only page that can complete it, and nothing else in the
 * app links a user back there — the dashboard nav has no /connect entry, so
 * without this a user who signed in from the connect page could never finish
 * connecting. Send them straight back instead.
 */
function shouldFinishConnect(roles: UserRole[] | undefined, stellarAddress: string | null): boolean {
  return stellarAddress === null || stellarAddress === undefined;
}

/**
 * GitHub OAuth callback handler (#591).
 *
 * The backend redirects with `?code=<one-time handoff code>`. The SPA must
 * POST the code to `/auth/handoff` to exchange it for an access token.
 * Falls back to `?token=` for direct token auth.
 */
export function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const token = searchParams.get("token");

    async function completeSignIn(accessToken: string) {
      const resolvedUser = await login(accessToken);
      // A null user here means the token exchange did not resolve a
      // profile. Landing on a dashboard would render that dashboard's
      // demo/mock data as if it were real, so surface the failure instead.
      if (!resolvedUser) {
        setError("sign-in-failed");
        return;
      }
      // A validated same-origin destination (e.g. the bounty the user was
      // claiming) wins over the default landing pages.
      router.replace(
        takeReturnTo() ??
          (shouldFinishConnect(resolvedUser.roles, resolvedUser.stellarAddress)
            ? "/connect"
            : redirectForRoles(resolvedUser.roles)),
      );
    }

    async function handleCallback() {
      // Try code-based handoff first (backend redirects with ?code=)
      if (code) {
        try {
          const response = await fetch("/api/auth/handoff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });

          if (!response.ok) {
            throw new Error("Handoff failed");
          }

          const data = await response.json();
          const accessToken = data.accessToken || data.access_token;

          if (!accessToken) {
            throw new Error("No access token in response");
          }

          await completeSignIn(accessToken);
        } catch {
          setError("sign-in-failed");
        }
        return;
      }

      // Fallback: direct token auth
      if (token) {
        // Strip the JWT from the URL immediately so it doesn't persist in
        // browser history, referrer headers, or server logs (#9).
        window.history.replaceState({}, "", window.location.pathname);
        try {
          await completeSignIn(token);
        } catch {
          setError("sign-in-failed");
        }
        return;
      }

      // No code or token
      setError("no-token");
    }

    void handleCallback();
  }, [searchParams, login, router]);

  const copy =
    error === "no-token"
      ? {
          title: "No token was returned by GitHub sign-in.",
          body: "GitHub did not return an authentication token. Please try signing in again.",
        }
      : {
          title: "Could not complete sign-in. Please try again.",
          body: "Make sure the mergefi-backend is running and reachable.",
        };

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      {error ? (
        <>
          <p role="alert" className="font-medium text-rose-600">{copy.title}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{copy.body}</p>
        </>
      ) : (
        <p role="status" aria-live="polite" className="text-slate-500 dark:text-slate-400">
          Finishing sign-in…
        </p>
      )}
    </div>
  );
}
