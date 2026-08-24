"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, MoreHorizontal, Plug, Power, Share2, Trash2, Zap } from "lucide-react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@tael/ui";
import type { ProductAction } from "@tael/database";
import { deleteAction, toggleAction, updateAction } from "./action-actions";
import { ConnectActionDialog } from "./action-dialogs";

const KIND_META: Record<ProductAction["kind"], { label: string; icon: typeof Zap; tone: string }> =
  {
    capability: {
      label: "Capability",
      icon: Zap,
      tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    http: {
      label: "HTTP",
      icon: Link2,
      tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
  };

function configSummary(item: ProductAction): string {
  if (item.kind === "capability" && "slug" in item.config) {
    return item.config.operation
      ? `${item.config.slug}/${item.config.operation}`
      : item.config.slug;
  }
  if (item.kind === "http" && "url" in item.config) {
    return `${item.config.method} ${item.config.url}`;
  }
  return "";
}

/** Train → Actions: connect + manage, styled to match the content manager. */
export function TrainActionsPanel({
  productId,
  items,
}: {
  productId: string;
  items: ProductAction[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4 border-t pt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
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

function ActionList({ items }: { items: ProductAction[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        No actions yet. Connect a capability or HTTP endpoint the agent can propose.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <ul className="divide-y">
        {items.map((item) => (
          <ActionRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function ActionRow({ item }: { item: ProductAction }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const summary = configSummary(item);

  function onToggle() {
    startTransition(async () => {
      await toggleAction(item.id, !item.enabled);
      router.refresh();
    });
  }

  function onShare() {
    startTransition(async () => {
      await updateAction(item.id, { shareAsCapability: !item.shareAsCapability });
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      await deleteAction(item.id);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/30">
      <span
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          meta.tone,
        )}
        title={meta.label}
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        {summary ? (
          <p className="truncate font-mono text-xs text-muted-foreground">{summary}</p>
        ) : (
          <p className="truncate text-xs text-muted-foreground">{meta.label}</p>
        )}
      </div>

      {item.shareAsCapability ? (
        <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
          Shared
        </Badge>
      ) : null}

      <Badge
        variant="outline"
        className={cn(
          "shrink-0 font-medium",
          item.enabled
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "text-muted-foreground",
        )}
      >
        {item.enabled ? "Enabled" : "Disabled"}
      </Badge>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label={`Actions for ${item.name}`}
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => {
              setMenuOpen(false);
              onToggle();
            }}
          >
            <Power className="h-4 w-4" /> {item.enabled ? "Disable" : "Enable"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => {
              setMenuOpen(false);
              onShare();
            }}
          >
            <Share2 className="h-4 w-4" />
            {item.shareAsCapability ? "Stop sharing" : "Share as capability"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={pending}
            onSelect={() => {
              setMenuOpen(false);
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
