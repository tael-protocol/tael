"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Globe,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Power,
  Quote,
  Trash2,
} from "lucide-react";
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
import type { ProductContent } from "@tael/database";
import { deleteContent, toggleContent } from "./content-actions";
import { EditContentDialog } from "./content-dialogs";

const TYPE_META: Record<
  ProductContent["type"],
  { label: string; icon: typeof FileText; tone: string }
> = {
  doc: {
    label: "Doc",
    icon: FileText,
    tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  snippet: {
    label: "Snippet",
    icon: Quote,
    tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  website: {
    label: "Website",
    icon: Globe,
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  faq: {
    label: "FAQ",
    icon: HelpCircle,
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
};

export function ContentList({ items }: { items: ProductContent[] }) {
  const [editing, setEditing] = useState<ProductContent | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        No content yet. Add a website, doc, snippet, or FAQ to train this agent.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border">
        <ul className="divide-y">
          {items.map((item) => (
            <ContentRow key={item.id} item={item} onEdit={() => setEditing(item)} />
          ))}
        </ul>
      </div>
      <EditContentDialog open={editing != null} onClose={() => setEditing(null)} item={editing} />
    </>
  );
}

function ContentRow({ item, onEdit }: { item: ProductContent; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;

  function onToggle() {
    startTransition(async () => {
      await toggleContent(item.id, !item.enabled);
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
        <p className="truncate text-sm font-semibold">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.sourceUrl ?? meta.label}</p>
      </div>

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
            aria-label={`Actions for ${item.title}`}
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false);
              onEdit();
            }}
          >
            <Pencil className="h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => {
              setMenuOpen(false);
              onToggle();
            }}
          >
            <Power className="h-4 w-4" /> {item.enabled ? "Disable" : "Enable"}
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
