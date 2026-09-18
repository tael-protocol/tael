"use client";

import { DatabaseErrorState } from "../../components/database-error-state";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DatabaseErrorState onRetry={reset} />;
}
