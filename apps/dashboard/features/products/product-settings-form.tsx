"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
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
import type { Product } from "@tael/database";
import { deleteProduct, updateProduct } from "./actions";

/** Basic product settings: name, brand color, greeting. Delete lives here too. */
export function ProductSettingsForm({ product }: { product: Product }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const [name, setName] = useState(product.name);
  const [brandColor, setBrandColor] = useState(product.brandColor);
  const [greeting, setGreeting] = useState(product.greeting);
  const [status, setStatus] = useState(product.status);

  const dirty =
    name !== product.name ||
    brandColor !== product.brandColor ||
    greeting !== product.greeting ||
    status !== product.status;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateProduct(product.id, { name, brandColor, greeting, status });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.error ?? "Could not save.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteProduct(product.id);
      if (res.ok) router.push("/studio/train");
      else setError(res.error ?? "Could not delete.");
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="text-base font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Name, brand color, and the greeting shown when the widget opens.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Brand color</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
              aria-label="Pick brand color"
            />
            <Input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="font-mono uppercase"
              placeholder="#156DFC"
            />
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Greeting</span>
          <Textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="Hi! How can I help you today?"
            rows={3}
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Live on your site</span>
            <span className="block text-xs text-muted-foreground">
              When on, visitors can use the embed. Draft still works in Test.
            </span>
          </span>
          <input
            type="checkbox"
            checked={status === "live"}
            onChange={(e) => setStatus(e.target.checked ? "live" : "draft")}
            className="h-4 w-4 accent-foreground"
            aria-label="Set agent live"
          />
        </label>

        <dl className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Slug</dt>
            <dd className="font-mono text-xs">{product.slug}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Public key</dt>
            <dd className="truncate font-mono text-xs">{product.publicKey}</dd>
          </div>
        </dl>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending || !dirty || !name.trim()}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> Saved
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-destructive/20 p-5">
        <div>
          <h2 className="text-base font-semibold text-destructive">Delete agent</h2>
          <p className="text-sm text-muted-foreground">
            Permanently removes this agent and its content. This cannot be undone.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {product.name}?</DialogTitle>
            <DialogDescription>
              Type the agent name to confirm. Content and actions will be removed.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={product.name}
          />
          <Button
            variant="destructive"
            disabled={pending || confirmText !== product.name}
            onClick={remove}
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
