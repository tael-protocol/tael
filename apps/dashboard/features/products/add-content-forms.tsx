"use client";

import { useState } from "react";
import { FileText, Globe, HelpCircle, Quote } from "lucide-react";
import { Button } from "@tael/ui";
import { FaqDialog, TextContentDialog, WebsiteDialog } from "./content-dialogs";

type Mode = "website" | "doc" | "snippet" | "faq" | null;

/** Four entry points for adding Train content, each opening a focused dialog. */
export function AddContentForms({ productId }: { productId: string }) {
  const [mode, setMode] = useState<Mode>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setMode("website")}>
          <Globe className="h-4 w-4" /> Sync website
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setMode("doc")}>
          <FileText className="h-4 w-4" /> Add doc
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setMode("snippet")}>
          <Quote className="h-4 w-4" /> Add snippet
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setMode("faq")}>
          <HelpCircle className="h-4 w-4" /> Add FAQ
        </Button>
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
