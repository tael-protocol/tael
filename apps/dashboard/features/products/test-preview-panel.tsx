"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, cn } from "@tael/ui";
import type { Product } from "@tael/database";
import type { ProposedWidgetAction } from "./widget-chat";

interface ChatLine {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: ProposedWidgetAction;
  actionDone?: boolean;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `t${counter}-${Date.now()}`;
}

/** In-dashboard Test chat: hits the widget endpoints with ?preview=1. */
export function TestPreviewPanel({ product }: { product: Product }) {
  const [messages, setMessages] = useState<ChatLine[]>(() =>
    product.greeting.trim()
      ? [{ id: nextId(), role: "assistant", content: product.greeting.trim() }]
      : [],
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatBase = `/api/widget/${encodeURIComponent(product.publicKey)}`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setDraft("");

    const userMsg: ChatLine = { id: nextId(), role: "user", content };
    const history = [...messages, userMsg].filter((m) => m.role === "user" || m.content);
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(`${chatBase}/chat?preview=1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        reply?: string;
        action?: ProposedWidgetAction | null;
        error?: string;
      } | null;

      if (!res.ok || !data) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: data?.error ?? "Something went wrong. Please try again.",
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: data.reply ?? "",
          action: data.action ?? undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: "Could not reach the agent. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(messageId: string, action: ProposedWidgetAction) {
    if (busy) return;
    setBusy(true);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, actionDone: true } : m)));

    try {
      const res = await fetch(`${chatBase}/actions/run?preview=1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionId: action.actionId,
          ...(action.params != null ? { params: action.params } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        body?: string;
      } | null;

      let content: string;
      if (
        res.status === 401 ||
        data?.error === "Not signed in." ||
        data?.error === "Pick a Card to pay for this run."
      ) {
        content =
          "This action needs the site owner (and a Card for capability runs). HTTP actions work for everyone.";
      } else if (!res.ok || !data?.ok) {
        content = data?.error ?? "Could not run that action.";
      } else {
        content = data.body
          ? `Ran ${action.name}.\n\n${data.body.slice(0, 600)}`
          : `Ran ${action.name}.`;
      }

      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: "Could not reach the server. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex h-[min(640px,calc(100vh-12rem))] flex-col overflow-hidden rounded-xl border">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: product.brandColor }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">Preview mode (draft agents work here)</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Ask something your agent should know from Train content.
          </p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "rounded-br-sm bg-foreground text-background"
                  : "rounded-bl-sm bg-background border",
              )}
            >
              {m.content}
            </div>
            {m.action && !m.actionDone ? (
              <div className="w-full max-w-[280px] rounded-xl border bg-background p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {m.action.kind === "http" ? "Run action" : "Run capability"}
                </p>
                <p className="mt-0.5 text-sm font-medium">{m.action.name}</p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={busy}
                  onClick={() => confirmAction(m.id, m.action!)}
                >
                  Confirm
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        {busy ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Thinking…
          </p>
        ) : null}
      </div>

      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message your agent…"
          disabled={busy}
          className="flex-1"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          Send
        </Button>
      </form>
    </section>
  );
}
