"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "@tael/ui";
import { addAction, type AddActionInput } from "./action-actions";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

type Kind = "capability" | "http";

/** Dialog to register a capability or HTTP action for the product agent. */
export function ConnectActionDialog({
  open,
  onClose,
  productId,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Kind>("capability");
  const [slug, setSlug] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">("POST");
  const [shareAsCapability, setShareAsCapability] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setKind("capability");
    setSlug("");
    setUrl("");
    setMethod("POST");
    setShareAsCapability(false);
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const input: AddActionInput =
        kind === "capability"
          ? {
              name,
              description,
              kind: "capability",
              config: { slug },
              shareAsCapability,
            }
          : {
              name,
              description,
              kind: "http",
              config: { url, method },
              shareAsCapability,
            };

      const res = await addAction(productId, input);
      if (res.ok) {
        reset();
        onClose();
        router.refresh();
      } else {
        setError(res.error ?? "Could not add action.");
      }
    });
  }

  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    (kind === "capability" ? slug.trim().length > 0 : url.trim().length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect action</DialogTitle>
          <DialogDescription>
            Register a capability or HTTP endpoint this agent can propose to visitors.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Book a demo"
              autoFocus
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When should the agent offer this action?"
              rows={3}
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Kind</legend>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind("capability")}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  kind === "capability"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Capability
              </button>
              <button
                type="button"
                onClick={() => setKind("http")}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  kind === "http"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                HTTP
              </button>
            </div>
          </fieldset>

          {kind === "capability" ? (
            <Field label="Capability slug">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. stellar-pay"
                className="font-mono text-sm"
              />
            </Field>
          ) : (
            <>
              <Field label="URL">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/hook"
                />
              </Field>
              <Field label="Method">
                <select
                  value={method}
                  onChange={(e) =>
                    setMethod(e.target.value as "GET" | "POST" | "PUT" | "PATCH" | "DELETE")
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shareAsCapability}
              onChange={(e) => setShareAsCapability(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Share as capability
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={submit} disabled={pending || !canSubmit}>
            {pending ? "Saving…" : "Connect action"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
