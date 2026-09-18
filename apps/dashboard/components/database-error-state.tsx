"use client";

import { DatabaseZap } from "lucide-react";
import { Button } from "@tael/ui";
import { EmptyState } from "./empty-state";

interface DatabaseErrorStateProps {
  onRetry: () => void;
}

export function DatabaseErrorState({ onRetry }: DatabaseErrorStateProps) {
  return (
    <EmptyState
      icon={DatabaseZap}
      title="Couldn't load this page"
      description="The dashboard couldn't reach Postgres. The project in DATABASE_URL is usually paused or deleted, or the URI points at the wrong pooler. Restore it, then retry."
      action={
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
