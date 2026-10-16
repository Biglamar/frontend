"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#fbfbfd] text-slate-900 dark:bg-[#0a0a0f] dark:text-white">
        <div className="mx-auto max-w-md px-6 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Something went wrong
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Unexpected error</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
