"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@tael/ui";
import { getWalletKit } from "./wallet-kit";

export function ConnectWalletButton({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    setLoading(true);
    try {
      const kit = await getWalletKit();

      // Opens the wallet picker, sets the chosen wallet active, returns its address.
      const { address } = await kit.authModal();

      const challengeRes = await fetch(
        `/api/auth/challenge?address=${encodeURIComponent(address)}`,
      );
      if (!challengeRes.ok) throw new Error("Could not start sign-in");
      const { message, challengeToken } = (await challengeRes.json()) as {
        message: string;
        challengeToken: string;
      };

      const { signedMessage } = await kit.signMessage(message, { address });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, signature: signedMessage, challengeToken }),
      });
      if (!verifyRes.ok) {
        const data = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Sign-in failed");
      }

      router.push(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/");
      router.refresh();
    } catch (err) {
      // authModal rejects when the user simply closes the picker — don't shout about that.
      const message = err instanceof Error ? err.message : "Sign-in failed";
      setError(/clos|cancel|reject|dismiss/i.test(message) ? null : message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => void connect()} disabled={loading}>
        {loading ? "Connecting…" : "Connect Stellar wallet"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
