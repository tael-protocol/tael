import type { Product } from "@tael/database";
import { deleteDiscordChannelLink, getDiscordChannelLink } from "./channel-links";
import { createDiscordConnectToken } from "../../lib/connect-token";
import { editDiscordInteractionResponse } from "./discord";

/** Handle /connect /wallet /disconnect after Discord deferred ACK. */
export async function handleDiscordWalletCommand(input: {
  applicationId: string;
  interactionToken: string;
  command: string;
  discordUserId: string | null;
  product: Product;
  dashboardBase: string;
  isDm: boolean;
}): Promise<boolean> {
  const { applicationId, interactionToken, command, discordUserId, product, dashboardBase, isDm } =
    input;

  if (command !== "connect" && command !== "wallet" && command !== "disconnect") {
    return false;
  }

  if (!discordUserId) {
    await editDiscordInteractionResponse(
      applicationId,
      interactionToken,
      "Could not identify your Discord user.",
    );
    return true;
  }

  if (command === "connect") {
    if (!isDm) {
      await editDiscordInteractionResponse(
        applicationId,
        interactionToken,
        `For security, connect your wallet in a **DM** with this bot (not a server channel).\n\n1. Open my profile → Message\n2. Run \`/connect\` there\n3. Open the link, Freighter sign-in, link a Card`,
      );
      return true;
    }

    const connectToken = await createDiscordConnectToken({
      externalUserId: discordUserId,
      productId: product.id,
      productPublicKey: product.publicKey,
      productName: product.name,
    });
    const url = `${dashboardBase}/connect/discord?t=${encodeURIComponent(connectToken)}`;
    await editDiscordInteractionResponse(
      applicationId,
      interactionToken,
      `Connect your Stellar wallet for **${product.name}** (expires in 15 min).\n\n1. Open: ${url}\n2. Sign in with Freighter\n3. Link a Card\n4. Come back here and run paid actions in this DM`,
    );
    return true;
  }

  if (command === "wallet") {
    const link = await getDiscordChannelLink(product.id, discordUserId);
    if (!link) {
      await editDiscordInteractionResponse(
        applicationId,
        interactionToken,
        "No wallet linked yet. Open a DM with this bot and run `/connect`.",
      );
    } else {
      await editDiscordInteractionResponse(
        applicationId,
        interactionToken,
        "Wallet linked. Paid actions in DMs will use your linked Card. Run `/disconnect` to unlink.",
      );
    }
    return true;
  }

  // disconnect
  await deleteDiscordChannelLink(product.id, discordUserId);
  await editDiscordInteractionResponse(
    applicationId,
    interactionToken,
    "Wallet unlinked from this bot.",
  );
  return true;
}
