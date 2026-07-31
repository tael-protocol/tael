"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
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
import type { ProductContent } from "@tael/database";
import { addContent, syncWebsite, updateContent } from "./content-actions";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function WebsiteDialog({
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
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUrl("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await syncWebsite(productId, url);
      if (res.ok) {
        reset();
        onClose();
        router.refresh();
      } else {
        setError(res.error ?? "Could not sync.");
      }
    });
  }

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync website</DialogTitle>
          <DialogDescription>
            Fetches one page and stores its readable text. Multi-page crawl comes later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="URL">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://help.example.com/refunds"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim() && !pending) submit();
              }}
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={submit} disabled={pending || !url.trim()}>
            {pending ? "Syncing…" : "Sync page"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TextContentDialog({
  open,
  onClose,
  productId,
  type,
  titleLabel,
  bodyLabel,
  bodyPlaceholder,
  dialogTitle,
  dialogDescription,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  type: "doc" | "snippet";
  titleLabel: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  dialogTitle: string;
  dialogDescription: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setBody("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addContent(productId, { type, title, body });
      if (res.ok) {
        reset();
        onClose();
        router.refresh();
      } else {
        setError(res.error ?? "Could not add content.");
      }
    });
  }

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
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={titleLabel}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label={bodyLabel}>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={bodyPlaceholder}
              rows={type === "doc" ? 8 : 4}
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={submit}
            disabled={pending || !title.trim() || !body.trim()}
          >
            {pending ? "Saving…" : "Add content"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FaqDialog({
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
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setQuestion("");
    setAnswer("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addContent(productId, {
        type: "faq",
        title: question,
        body: answer,
      });
      if (res.ok) {
        reset();
        onClose();
        router.refresh();
      } else {
        setError(res.error ?? "Could not add FAQ.");
      }
    });
  }

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
          <DialogTitle>Add FAQ</DialogTitle>
          <DialogDescription>
            A question and answer the agent can use when users ask about it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Question">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus />
          </Field>
          <Field label="Answer">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="The answer the agent should give…"
              rows={4}
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={submit}
            disabled={pending || !question.trim() || !answer.trim()}
          >
            {pending ? "Saving…" : "Add FAQ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Edit an existing content row (title + body). */
export function EditContentDialog({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: ProductContent | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && item) {
      setTitle(item.title);
      setBody(item.body);
      setError(null);
    }
  }, [open, item]);

  function reset() {
    setTitle("");
    setBody("");
    setError(null);
  }

  function submit() {
    if (!item) return;
    setError(null);
    startTransition(async () => {
      const res = await updateContent(item.id, { title, body });
      if (res.ok) {
        reset();
        onClose();
        router.refresh();
      } else {
        setError(res.error ?? "Could not save.");
      }
    });
  }

  const isFaq = item?.type === "faq";

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
          <DialogTitle>Edit {isFaq ? "FAQ" : "content"}</DialogTitle>
          <DialogDescription>Update what the agent can use from this source.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={isFaq ? "Question" : "Title"}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label={isFaq ? "Answer" : "Content"}>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={item?.type === "doc" ? 8 : 4}
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={submit}
            disabled={pending || !title.trim() || !body.trim()}
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
