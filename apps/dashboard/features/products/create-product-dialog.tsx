"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@tael/ui";
import { createProduct } from "./actions";

/** Create a product agent from a name. Redirects to the detail page on success. */
export function CreateProductDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  function reset() {
    setError(null);
    setName("");
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createProduct({ name });
      if (res.ok && res.id) {
        setOpen(false);
        reset();
        router.push(`/studio/${res.id}`);
        router.refresh();
      } else {
        setError(res.error ?? "Could not create the agent.");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New agent</Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-md overflow-hidden">
          <DialogHeader className="min-w-0">
            <DialogTitle>New agent</DialogTitle>
            <DialogDescription>
              Train it on your content, connect actions, and embed it on your site.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme DEX"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() && !pending) submit();
                }}
              />
            </label>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button className="w-full" onClick={submit} disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create agent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
