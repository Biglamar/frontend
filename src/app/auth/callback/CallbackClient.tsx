"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

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

          await login(accessToken);
          router.replace("/dashboard/contributor");
          return;
        } catch {
          setError("Could not complete sign-in. Please try again.");
          return;
        }
      }

      // Fallback: direct token auth
      if (token) {
        try {
          await login(token);
          router.replace("/dashboard/contributor");
        } catch {
          setError("Could not complete sign-in. Please try again.");
        }
        return;
      }

      // No code or token
      setError("No token was returned by GitHub sign-in.");
    }

    void handleCallback();
  }, [searchParams, login, router]);

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      {error ? (
        <>
          <p className="font-medium text-rose-600">{error}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Make sure the mergefi-backend is running and reachable.
          </p>
        </>
      ) : (
        <p className="text-slate-500 dark:text-slate-400">Finishing sign-in…</p>
      )}
    </div>
  );
}
