import { Suspense } from "react";
import type { Metadata } from "next";
import { CallbackClient } from "./CallbackClient";

export const metadata: Metadata = {
  title: "Signing in… | MergeFi",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p role="status" aria-live="polite" className="text-sm text-slate-500 dark:text-slate-400">
            Finishing sign-in…
          </p>
        </div>
      }
    >
      <CallbackClient />
    </Suspense>
  );
}
