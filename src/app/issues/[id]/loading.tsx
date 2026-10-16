export default function IssueDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-8 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-2 h-5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
      <div className="mt-8 h-48 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}
