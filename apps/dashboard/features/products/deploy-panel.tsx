"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Globe, MessageCircle, Radio, Server } from "lucide-react";
import { Button, cn } from "@tael/ui";
import type { Product } from "@tael/database";

const CHANNELS = [
  {
    id: "website",
    label: "Website",
    description: "Embed the chat widget on your site.",
    icon: Globe,
    status: "live" as const,
  },
  {
    id: "discord",
    label: "Discord",
    description: "Answer in your Discord server.",
    icon: MessageCircle,
    status: "soon" as const,
  },
  {
    id: "telegram",
    label: "Telegram",
    description: "A bot for your Telegram channel.",
    icon: Radio,
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

/** Deploy: embed snippet + channel availability. */
export function DeployPanel({ product }: { product: Product }) {
  const [copied, setCopied] = useState(false);
  const [base, setBase] = useState(
    () => process.env.NEXT_PUBLIC_DASHBOARD_URL?.replace(/\/$/, "") ?? "",
  );

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
          <h2 className="text-base font-semibold">Channels</h2>
          <p className="text-sm text-muted-foreground">
            Where this agent can show up. Website is ready; more channels are on the way.
          </p>
        </div>

        <ul className="divide-y overflow-hidden rounded-xl border">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const live = ch.status === "live";
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
