"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Globe, HelpCircle, Quote, Trash2 } from "lucide-react";
import { Button, cn } from "@tael/ui";
import type { ProductContent } from "@tael/database";
import { deleteContent, toggleContent } from "./content-actions";

const TYPE_META: Record<
  ProductContent["type"],
  { label: string; icon: typeof FileText; badge: string }
> = {
  doc: {
    label: "Doc",
    icon: FileText,
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  snippet: {
    label: "Snippet",
    icon: Quote,
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  website: {
    label: "Website",
    icon: Globe,
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  faq: {
    label: "FAQ",
    icon: HelpCircle,
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
};

export function ContentList({ items }: { items: ProductContent[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        No content yet. Add a doc, snippet, FAQ, or sync a website to train this agent.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <ul className="divide-y">
        {items.map((item) => (
          <ContentRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function ContentRow({ item }: { item: ProductContent }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;

  function onToggle(enabled: boolean) {
    startTransition(async () => {
      await toggleContent(item.id, enabled);
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      await deleteContent(item.id);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
          meta.badge,
        )}
      >
        <Icon className="h-3.5 w-3.5" /> {meta.label}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.title}</p>
        {item.sourceUrl ? (
          <p className="truncate text-xs text-muted-foreground">{item.sourceUrl}</p>
        ) : null}
      </div>

      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">{item.enabled ? "Enabled" : "Disabled"}</span>
        <input
          type="checkbox"
          checked={item.enabled}
          disabled={pending}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-foreground"
          aria-label={item.enabled ? "Disable content" : "Enable content"}
        />
      </label>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={onDelete}
        aria-label={`Delete ${item.title}`}
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
