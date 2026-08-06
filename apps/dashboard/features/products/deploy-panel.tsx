"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Globe, MessageCircle, Radio, Server, Bot, Unplug } from "lucide-react";
import { Button, Input, cn } from "@tael/ui";
import type { Product } from "@tael/database";
import { connectTelegramBot, disconnectTelegramBot } from "./actions";

export function DeployPanel({ product }: { product: Product }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [base, setBase] = useState(
    () => process.env.NEXT_PUBLIC_DASHBOARD_URL?.replace(/\/$/, "") ?? "",
  );

  const settings = (product.settings as Record<string, unknown>) ?? {};
  const currentBotUsername =
    typeof settings.telegramBotUsername === "string" ? settings.telegramBotUsername : "";
  const isTelegramEnabled = settings.telegramBotEnabled === true;

  const [telegramToken, setTelegramToken] = useState("");
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_DASHBOARD_URL) {
      setBase(window.location.origin);
    }
  }, []);

  const snippet = base
    ? `<script src="${base}/embed.js" data-tael-key="${product.publicKey}"></script>`
    : `<script src=".../embed.js" data-tael-key="${product.publicKey}"></script>`;

  async function copy() {
    if (!base) return;
    try {
      await navigator.clipboard.writeText(
        `<script src="${base}/embed.js" data-tael-key="${product.publicKey}"></script>`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  }

  function handleConnectTelegram() {
    setTelegramError(null);
    setTelegramSuccess(null);
    startTransition(async () => {
      const res = await connectTelegramBot(
        product.id,
        telegramToken,
        base || window.location.origin,
      );
      if (res.ok) {
        setTelegramSuccess(`Connected successfully as @${res.botUsername ?? "bot"}`);
        router.refresh();
      } else {
        setTelegramError(res.error ?? "Could not connect Telegram Bot.");
      }
    });
  }

  function handleDisconnectTelegram() {
    setTelegramError(null);
    setTelegramSuccess(null);
    startTransition(async () => {
      const res = await disconnectTelegramBot(product.id);
      if (res.ok) {
        setTelegramSuccess("Telegram bot disconnected.");
        setTelegramToken("");
        router.refresh();
      } else {
        setTelegramError(res.error ?? "Could not disconnect Telegram Bot.");
      }
    });
  }

  const channels = [
    {
      id: "website",
      label: "Website",
      description: "Embed the chat widget on your site.",
      icon: Globe,
      status: "live" as const,
    },
    {
      id: "telegram",
      label: "Telegram",
      description: "A bot for your Telegram channel.",
      icon: Radio,
      status: isTelegramEnabled ? ("live" as const) : ("ready" as const),
    },
    {
      id: "discord",
      label: "Discord",
      description: "Answer in your Discord server.",
      icon: MessageCircle,
      status: "soon" as const,
    },
    {
      id: "mcp",
      label: "MCP",
      description: "Expose this agent as an MCP server.",
      icon: Server,
      status: "soon" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="text-base font-semibold">Embed snippet</h2>
          <p className="text-sm text-muted-foreground">
            Paste this before the closing body tag on any page. The widget loads from Tael and talks
            to your agent.
          </p>
        </div>

        {product.status !== "live" ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            This agent is still a draft. Set it live in Settings so the embed works for visitors.
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border bg-muted/30">
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">{snippet}</pre>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copy} disabled={!base}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy snippet"}
          </Button>
          <span className="font-mono text-xs text-muted-foreground">{product.publicKey}</span>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="text-base font-semibold">Telegram Bot Integration</h2>
          <p className="text-sm text-muted-foreground">
            Connect a Telegram Bot token to serve your product agent on Telegram. Train once, serve
            everywhere.
          </p>
        </div>

        {isTelegramEnabled && currentBotUsername ? (
          <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <Bot className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Connected as @{currentBotUsername}</p>
                  <p className="text-xs text-muted-foreground">
                    Webhook active and listening for messages.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDisconnectTelegram}
                disabled={pending}
              >
                <Unplug className="h-4 w-4 mr-1" /> Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Bot Token (from @BotFather)</span>
              <Input
                type="password"
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
              />
            </label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={handleConnectTelegram}
                disabled={pending || !telegramToken.trim()}
              >
                {pending ? "Connecting…" : "Connect & Deploy Bot"}
              </Button>
            </div>
          </div>
        )}

        {telegramError ? <p className="text-sm text-destructive">{telegramError}</p> : null}
        {telegramSuccess ? (
          <p className="text-sm text-emerald-600 flex items-center gap-1">
            <Check className="h-4 w-4" /> {telegramSuccess}
          </p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border p-5">
        <div>
          <h2 className="text-base font-semibold">Channels</h2>
          <p className="text-sm text-muted-foreground">
            Where this agent can show up. Website and Telegram are ready; more channels are on the
            way.
          </p>
        </div>

        <ul className="divide-y overflow-hidden rounded-xl border">
          {channels.map((ch) => {
            const Icon = ch.icon;
            const live = ch.status === "live";
            const ready = ch.status === "ready";
            return (
              <li
                key={ch.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    live
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : ready
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{ch.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{ch.description}</p>
                </div>
                {live ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                  </span>
                ) : ready ? (
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                    Ready to connect
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Coming soon
                  </span>
                )}
                <input
                  type="checkbox"
                  checked={live}
                  disabled
                  readOnly
                  className="h-4 w-4 accent-foreground"
                  aria-label={`${ch.label} channel`}
                />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
