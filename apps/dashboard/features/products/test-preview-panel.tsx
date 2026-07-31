"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@tael/ui";
import type { Product } from "@tael/database";
import { SendIcon } from "../agent/icons";
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

/**
 * Live chat preview for Studio Train / Test. Dark panel matching the Tael
 * agent widget; hits widget endpoints with ?preview=1.
 */
export function TestPreviewPanel({ product, className }: { product: Product; className?: string }) {
  const [messages, setMessages] = useState<ChatLine[]>(() =>
    product.greeting.trim()
      ? [{ id: nextId(), role: "assistant", content: product.greeting.trim() }]
      : [],
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatBase = `/api/widget/${encodeURIComponent(product.publicKey)}`;
  const brand = product.brandColor || "#156DFC";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function clear() {
    setMessages(
      product.greeting.trim()
        ? [{ id: nextId(), role: "assistant", content: product.greeting.trim() }]
        : [],
    );
  }

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
      inputRef.current?.focus();
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
    <section
      className={cn(
        "flex h-[min(720px,calc(100vh-8rem))] flex-col overflow-hidden rounded-[20px] bg-[#14161a] text-white shadow-[0_24px_70px_-20px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: brand }}
          aria-hidden
        >
          {(product.name.charAt(0) || "A").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{product.name}</p>
          <p className="truncate text-xs text-white/50">Preview mode</p>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear chat"
            title="Clear chat"
            className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        ) : null}
      </header>

      <p className="border-b border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] leading-snug text-white/45">
        Preview mode. Drafts work here, you won&apos;t be charged.
      </p>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-white/40">
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
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]",
                m.role === "user"
                  ? "rounded-br-sm bg-white text-[#14161a]"
                  : "rounded-bl-sm bg-[#2c2d31] text-zinc-100",
              )}
            >
              {m.content}
            </div>
            {m.action && !m.actionDone ? (
              <div className="w-full max-w-[280px] rounded-2xl border border-white/10 bg-[#1c1d21] p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  {m.action.kind === "http" ? "Run action" : "Run capability"}
                </p>
                <p className="mt-0.5 text-[13.5px] font-medium text-zinc-100">{m.action.name}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirmAction(m.id, m.action!)}
                  className="mt-2.5 w-full rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-[#14161a] transition-all duration-150 ease-out hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {busy ? (
          <span className="flex items-center gap-1 py-1" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="p-3"
      >
        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 focus-within:border-white/25">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            placeholder="Message your agent…"
            disabled={busy}
            className="max-h-28 flex-1 resize-none bg-transparent text-[13.5px] text-white placeholder:text-white/40 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-all duration-150 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: busy || !draft.trim() ? "rgba(255,255,255,0.1)" : brand }}
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
  );
}
