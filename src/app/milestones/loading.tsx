export default function MilestonesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-36 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-3 w-48 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
