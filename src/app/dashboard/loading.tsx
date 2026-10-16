import { Card } from "@/components/ui/Card";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="mt-2 h-4 w-56 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-2 h-6 w-16 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} padding="md" className="h-48">
            <div className="h-5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="h-3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
