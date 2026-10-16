import { Card } from "@/components/ui/Card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="mt-2 h-4 w-72 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} padding="md" className="h-48">
            <div className="h-5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="h-3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
