export default function ReputationLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div>
          <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 flex gap-2">
            <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-7 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 flex gap-2">
          <div className="h-6 w-14 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}
