"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, MessageCircle, Unplug } from "lucide-react";
import { Button, Input } from "@tael/ui";
import type { Product } from "@tael/database";
import { connectDiscordBot, disconnectDiscordBot } from "./actions";
import { buildDiscordUserInstallUrl } from "./discord-urls";

interface DiscordConnectPanelProps {
  product: Product;
  baseUrl: string;
  pending: boolean;
  startTransition: (action: () => void | Promise<void>) => void;
}

export function DiscordConnectPanel({
  product,
  baseUrl,
  pending,
  startTransition,
}: DiscordConnectPanelProps) {
  const router = useRouter();
  const settings = (product.settings as Record<string, unknown>) ?? {};
  const discordBotUsername =
    typeof settings.discordBotUsername === "string" ? settings.discordBotUsername : "";
  const isDiscordEnabled = settings.discordBotEnabled === true;
  const discordClientId =
    typeof settings.discordClientId === "string" ? settings.discordClientId : "";

  const [discordToken, setDiscordToken] = useState("");
  const [discordPublicKey, setDiscordPublicKey] = useState("");
  const [discordAppId, setDiscordAppId] = useState("");
  const [discordError, setDiscordError] = useState<string | null>(null);
  const [discordSuccess, setDiscordSuccess] = useState<string | null>(null);
  const [discordInviteUrl, setDiscordInviteUrl] = useState<string | null>(null);
  const [copiedInteractions, setCopiedInteractions] = useState(false);

  const interactionsUrl = baseUrl
    ? `${baseUrl}/api/widget/${encodeURIComponent(product.publicKey)}/discord`
    : "";

  const inviteUrl = discordClientId
    ? `https://discord.com/oauth2/authorize?client_id=${discordClientId}&scope=bot%20applications.commands&permissions=2147485696`
    : discordInviteUrl;

  async function copyInteractionsUrl() {
    if (!interactionsUrl) return;
    try {
      await navigator.clipboard.writeText(interactionsUrl);
      setCopiedInteractions(true);
      setTimeout(() => setCopiedInteractions(false), 1500);
    } catch {
      // no-op
    }
  }

  function handleConnectDiscord() {
    setDiscordError(null);
    setDiscordSuccess(null);
    startTransition(async () => {
      const res = await connectDiscordBot(
        product.id,
        discordToken,
        discordPublicKey,
        discordAppId,
        baseUrl || window.location.origin,
      );
      if (res.ok) {
        setDiscordSuccess(
          `Connected as ${res.botUsername ?? "bot"}. Paste Interactions URL, then use DMs for /connect + paid actions.`,
        );
        setDiscordInviteUrl(res.inviteUrl ?? null);
        setDiscordToken("");
        router.refresh();
      } else {
        setDiscordError(res.error ?? "Could not connect Discord Bot.");
      }
    });
  }

  function handleDisconnectDiscord() {
    setDiscordError(null);
    setDiscordSuccess(null);
    startTransition(async () => {
      const res = await disconnectDiscordBot(product.id);
      if (res.ok) {
        setDiscordSuccess("Discord bot disconnected.");
        setDiscordToken("");
        setDiscordPublicKey("");
        setDiscordAppId("");
        setDiscordInviteUrl(null);
        router.refresh();
      } else {
        setDiscordError(res.error ?? "Could not disconnect Discord Bot.");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="text-base font-semibold">Discord Bot Integration</h2>
        <p className="text-sm text-muted-foreground">
          Connect your Discord application so people can{" "}
          <span className="font-mono text-xs">/ask</span> in servers or DMs. Wallet connect and paid
          actions are <span className="font-medium text-foreground">DM-only</span> for safety —
          Hermies-style private chat, not public channel spends.
        </p>
      </div>

      {isDiscordEnabled && discordBotUsername ? (
        <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <MessageCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Connected as {discordBotUsername}</p>
                <p className="text-xs text-muted-foreground">
                  /ask registered. Finish setup by pasting the Interactions URL in Discord.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDisconnectDiscord}
              disabled={pending}
            >
              <Unplug className="h-4 w-4 mr-1" /> Disconnect
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border bg-background/60 p-3">
            <p className="text-xs font-medium">1. Interactions Endpoint URL</p>
            <p className="text-xs text-muted-foreground">
              Discord Developer Portal → your app → General Information → Interactions Endpoint URL.
              Paste this, then Save Changes (Discord will ping to verify).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded bg-muted px-2 py-1 font-mono text-[11px]">
                {interactionsUrl}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyInteractionsUrl}>
                {copiedInteractions ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copiedInteractions ? "Copied" : "Copy URL"}
              </Button>
            </div>
          </div>

          {inviteUrl ? (
            <div className="space-y-2 rounded-lg border bg-background/60 p-3">
              <p className="text-xs font-medium">2. Invite the bot to your server</p>
              <a
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline"
              >
                Open invite link <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : null}

          {discordClientId ? (
            <div className="space-y-2 rounded-lg border bg-background/60 p-3">
              <p className="text-xs font-medium">3. Add App for personal DMs (Hermies-style)</p>
              <p className="text-xs text-muted-foreground">
                Users can install the app to their account and message the bot in DMs without a
                shared server. Also enable User Install in Discord → Installation if available.
              </p>
              <a
                href={buildDiscordUserInstallUrl(discordClientId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline"
              >
                Open user-install link <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <p className="text-xs text-muted-foreground">
                After reconnecting, commands include <span className="font-mono">/connect</span>,{" "}
                <span className="font-mono">/wallet</span>,{" "}
                <span className="font-mono">/disconnect</span>. Run them in a DM.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Create an application at{" "}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              discord.com/developers/applications
            </a>
            . Copy Application ID, Public Key (General Information), and Bot Token (Bot tab).
          </p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Bot Token</span>
            <Input
              type="password"
              placeholder="Discord bot token"
              value={discordToken}
              onChange={(e) => setDiscordToken(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Application Public Key</span>
            <Input
              type="text"
              placeholder="64-character hex public key"
              value={discordPublicKey}
              onChange={(e) => setDiscordPublicKey(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Application ID (Client ID)</span>
            <Input
              type="text"
              placeholder="Discord application / client id"
              value={discordAppId}
              onChange={(e) => setDiscordAppId(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              onClick={handleConnectDiscord}
              disabled={
                pending || !discordToken.trim() || !discordPublicKey.trim() || !discordAppId.trim()
              }
            >
              {pending ? "Connecting…" : "Connect & Deploy Bot"}
            </Button>
          </div>
        </div>
      )}

      {discordError ? <p className="text-sm text-destructive">{discordError}</p> : null}
      {discordSuccess ? (
        <p className="text-sm text-emerald-600 flex items-center gap-1">
          <Check className="h-4 w-4" /> {discordSuccess}
        </p>
      ) : null}
    </section>
  );
}
