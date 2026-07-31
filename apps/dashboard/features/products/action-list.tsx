"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Trash2, Zap } from "lucide-react";
import { Button, cn } from "@tael/ui";
import type { ProductAction } from "@tael/database";
import { deleteAction, toggleAction, updateAction } from "./action-actions";

const KIND_META: Record<ProductAction["kind"], { label: string; icon: typeof Zap; badge: string }> =
  {
    capability: {
      label: "Capability",
      icon: Zap,
      badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    http: {
      label: "HTTP",
      icon: Link2,
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
  };

function configSummary(item: ProductAction): string {
  if (item.kind === "capability" && "slug" in item.config) {
    return item.config.slug;
  }
  if (item.kind === "http" && "url" in item.config) {
    return `${item.config.method} ${item.config.url}`;
  }
  return "";
}

export function ActionList({ items }: { items: ProductAction[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
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
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const summary = configSummary(item);

  function onToggle(enabled: boolean) {
    startTransition(async () => {
      await toggleAction(item.id, enabled);
      router.refresh();
    });
  }

  function onShare(shareAsCapability: boolean) {
    startTransition(async () => {
      await updateAction(item.id, { shareAsCapability });
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
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
          meta.badge,
        )}
      >
        <Icon className="h-3.5 w-3.5" /> {meta.label}
      </span>

      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-medium">{item.name}</p>
        {summary ? (
          <p className="truncate font-mono text-xs text-muted-foreground">{summary}</p>
        ) : null}
      </div>

      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={item.shareAsCapability}
          disabled={pending}
          onChange={(e) => onShare(e.target.checked)}
          className="h-4 w-4 accent-foreground"
          aria-label="Share as capability"
        />
        <span className="hidden sm:inline">Share</span>
      </label>

      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">{item.enabled ? "Enabled" : "Disabled"}</span>
        <input
          type="checkbox"
          checked={item.enabled}
          disabled={pending}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-foreground"
          aria-label={item.enabled ? "Disable action" : "Enable action"}
        />
      </label>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={onDelete}
        aria-label={`Delete ${item.name}`}
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
