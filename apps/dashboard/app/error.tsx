"use client";

import { DatabaseErrorState } from "../components/database-error-state";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <DatabaseErrorState onRetry={reset} />
      </div>
    </div>
  );
}
