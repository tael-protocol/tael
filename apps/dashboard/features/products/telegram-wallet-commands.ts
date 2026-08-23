import type { Product } from "@tael/database";
import { deleteTelegramChannelLink, getTelegramChannelLink } from "./channel-links";
import { sendTelegramMessage } from "./telegram";
import { createTelegramConnectToken } from "../../lib/connect-token";

/** Handle /connect /wallet /disconnect. Returns true if a command was handled. */
export async function handleTelegramWalletCommands(input: {
  token: string;
  chatId: number;
  command: string;
  telegramUserId: string | null;
  product: Product;
  dashboardBase: string;
}): Promise<boolean> {
  const { token, chatId, command, telegramUserId, product, dashboardBase } = input;

  if (command === "/connect") {
    if (!telegramUserId) {
      await sendTelegramMessage(token, chatId, "Could not identify your Telegram user.");
      return true;
    }
    const connectToken = await createTelegramConnectToken({
      externalUserId: telegramUserId,
      productId: product.id,
      productPublicKey: product.publicKey,
      productName: product.name,
    });
    const url = `${dashboardBase}/connect/telegram?t=${encodeURIComponent(connectToken)}`;
    await sendTelegramMessage(
      token,
      chatId,
      `Connect your Stellar wallet to run paid actions for ${product.name}.\n\n1. Open this link (expires in 15 min)\n${url}\n\n2. Sign in with Freighter\n3. Link a Card\n4. Come back here and confirm an action`,
    );
    return true;
  }

  if (command === "/wallet") {
    if (!telegramUserId) {
      await sendTelegramMessage(token, chatId, "Could not identify your Telegram user.");
      return true;
    }
    const link = await getTelegramChannelLink(product.id, telegramUserId);
    if (!link) {
      await sendTelegramMessage(
        token,
        chatId,
        "No wallet linked yet. Send /connect to link your Stellar wallet + Card.",
      );
    } else {
      await sendTelegramMessage(
        token,
        chatId,
        "Wallet linked. Paid actions will use your linked Card. Send /disconnect to unlink.",
      );
    }
    return true;
  }

  if (command === "/disconnect") {
    if (!telegramUserId) {
      await sendTelegramMessage(token, chatId, "Could not identify your Telegram user.");
      return true;
    }
    await deleteTelegramChannelLink(product.id, telegramUserId);
    await sendTelegramMessage(token, chatId, "Wallet unlinked from this bot.");
    return true;
  }

  return false;
}
