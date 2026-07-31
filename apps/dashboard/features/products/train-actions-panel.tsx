"use client";

import { useState } from "react";
import { Plug } from "lucide-react";
import { Button } from "@tael/ui";
import type { ProductAction } from "@tael/database";
import { ConnectActionDialog } from "./action-dialogs";
import { ActionList } from "./action-list";

/** Train → Actions: connect capabilities / HTTP endpoints and manage the list. */
export function TrainActionsPanel({
  productId,
  items,
}: {
  productId: string;
  items: ProductAction[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4 rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Actions</h2>
          <p className="text-sm text-muted-foreground">
            Capabilities and HTTP calls this agent can propose. Visitors confirm before anything
            runs.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plug className="h-4 w-4" /> Connect action
        </Button>
      </div>
      <ConnectActionDialog open={open} onClose={() => setOpen(false)} productId={productId} />
      <ActionList items={items} />
    </section>
  );
}
