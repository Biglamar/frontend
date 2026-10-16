"use client";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundary error={error} reset={reset} title="Failed to load dashboard" />;
}
