export default function IssuesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 animate-pulse">
      <div className="h-8 w-36 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="mt-2 h-4 w-64 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-8 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-72 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
