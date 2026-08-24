"use client";

import { useState, useTransition } from "react";
import { Button } from "@tael/ui";
import { ConnectWalletButton } from "../../features/auth/connect-wallet-button";
import { createAgent } from "../../features/agents/actions";
import type { CardPickerOption } from "../../features/agents/queries";

interface TelegramConnectClientProps {
  token: string;
  productName: string;
  signedIn: boolean;
  walletAddress: string | null;
  cards: CardPickerOption[];
}

export function TelegramConnectClient({
  token,
  productName,
  signedIn,
  walletAddress,
  cards: initialCards,
}: TelegramConnectClientProps) {
  const [cards, setCards] = useState(initialCards);
  const [agentId, setAgentId] = useState(initialCards[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const redirectTo = `/connect/telegram?t=${encodeURIComponent(token)}`;

  function handleCreateCard() {
    setError(null);
    startTransition(async () => {
      const res = await createAgent({
        name: "Telegram Card",
        maxPerCall: "5",
        dailyLimit: "50",
      });
      if (!res.ok || !res.id) {
        setError(res.error ?? "Could not create a Card.");
        return;
      }
      const next = [...cards, { id: res.id, name: "Telegram Card", policy: null }];
      setCards(next);
      setAgentId(res.id);
    });
  }

  function handleComplete() {
    setError(null);
    if (!agentId) {
      setError("Create or select a Card first.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/connect/telegram/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, agentId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not link wallet.");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <h1 className="text-lg font-semibold">Wallet connected</h1>
        <p className="text-sm text-muted-foreground">
          Your Stellar wallet is linked to{" "}
          <span className="font-medium text-foreground">{productName}</span> on Telegram. Go back to
          the bot and run an action — your Card will pay.
        </p>
        {walletAddress ? (
          <p className="font-mono text-xs text-muted-foreground">{walletAddress}</p>
        ) : null}
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="space-y-4 rounded-xl border p-5">
        <div>
          <h1 className="text-lg font-semibold">Connect wallet for {productName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with Freighter so this Telegram bot can run paid actions using your Card.
          </p>
        </div>
        <ConnectWalletButton redirectTo={redirectTo} />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border p-5">
      <div>
        <h1 className="text-lg font-semibold">Link Card for {productName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <span className="font-mono text-xs">{walletAddress}</span>. Pick the Card
          that will pay for actions in Telegram.
        </p>
      </div>

      {cards.length > 0 ? (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Card</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">
          You do not have a Card yet. Create one to pay for Telegram actions.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {cards.length === 0 ? (
          <Button type="button" size="sm" onClick={handleCreateCard} disabled={pending}>
            {pending ? "Creating…" : "Create Card"}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={handleComplete} disabled={pending || !agentId}>
            {pending ? "Linking…" : "Link to Telegram"}
          </Button>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
