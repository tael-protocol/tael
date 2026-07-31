"use client";

import { useState } from "react";
import { FileText, Globe, HelpCircle, Quote, type LucideIcon } from "lucide-react";
import { cn } from "@tael/ui";
import { FaqDialog, TextContentDialog, WebsiteDialog } from "./content-dialogs";

type Mode = "website" | "doc" | "snippet" | "faq" | null;

const ADD_CARDS: {
  id: NonNullable<Mode>;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    id: "website",
    label: "Website",
    description: "Sync a page",
    icon: Globe,
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "doc",
    label: "Doc",
    description: "Longer text",
    icon: FileText,
    tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    id: "snippet",
    label: "Snippet",
    description: "Short note",
    icon: Quote,
    tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  {
    id: "faq",
    label: "FAQ",
    description: "Q & A",
    icon: HelpCircle,
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
];

/** Fin-style add-content cards; each opens an existing dialog. */
export function AddContentForms({ productId }: { productId: string }) {
  const [mode, setMode] = useState<Mode>(null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ADD_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setMode(card.id)}
              className={cn(
                "group flex flex-col items-start gap-3 rounded-xl border bg-background p-4 text-left transition-colors",
                "hover:border-foreground/20 hover:bg-muted/40 active:scale-[0.99]",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-lg",
                  card.tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{card.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {card.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <WebsiteDialog
        open={mode === "website"}
        onClose={() => setMode(null)}
        productId={productId}
      />
      <TextContentDialog
        open={mode === "doc"}
        onClose={() => setMode(null)}
        productId={productId}
        type="doc"
        titleLabel="Title"
        bodyLabel="Document"
        bodyPlaceholder="Paste the full document the agent should know…"
        dialogTitle="Add doc"
        dialogDescription="A longer document the agent can quote from."
      />
      <TextContentDialog
        open={mode === "snippet"}
        onClose={() => setMode(null)}
        productId={productId}
        type="snippet"
        titleLabel="Title"
        bodyLabel="Snippet"
        bodyPlaceholder="A short note, policy line, or fact…"
        dialogTitle="Add snippet"
        dialogDescription="A short piece of text the agent can reference."
      />
      <FaqDialog open={mode === "faq"} onClose={() => setMode(null)} productId={productId} />
    </div>
  );
}
