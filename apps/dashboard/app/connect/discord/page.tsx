import { DiscordConnectClient } from "../../../features/connect/discord-connect-client";
import { listCardsForPicker } from "../../../features/agents/queries";
import { getCurrentUser } from "../../../features/capabilities/current-user";
import { verifyDiscordConnectToken } from "../../../lib/connect-token";

export const dynamic = "force-dynamic";

export default async function DiscordConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token } = await searchParams;
  if (!token?.trim()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
        <p className="text-sm text-muted-foreground">
          Missing connect token. Run <span className="font-mono">/connect</span> in a DM with the
          Discord bot and open the new link.
        </p>
      </main>
    );
  }

  let connect;
  try {
    connect = await verifyDiscordConnectToken(token.trim());
  } catch {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
        <p className="text-sm text-muted-foreground">
          This connect link expired or is invalid. Run <span className="font-mono">/connect</span>{" "}
          in Discord again.
        </p>
      </main>
    );
  }

  const user = await getCurrentUser();
  const cards = user ? await listCardsForPicker() : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <div className="w-full">
        <DiscordConnectClient
          token={token.trim()}
          productName={connect.productName || "this product"}
          signedIn={Boolean(user)}
          walletAddress={user?.walletAddress ?? null}
          cards={cards}
        />
      </div>
    </main>
  );
}
