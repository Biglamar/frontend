"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export function ErrorBoundary({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
        Error
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
        {title}
      </h1>
      <p className="mt-3 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <Button onClick={reset} className="mt-8">
        Try again
      </Button>
    </div>
  );
}
