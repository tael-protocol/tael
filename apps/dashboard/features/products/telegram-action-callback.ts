import { getEnabledActionForPublicKey, runProductAction } from "./run-product-action";
import { getTelegramChannelLink } from "./channel-links";
import {
  answerTelegramCallbackQuery,
  editTelegramMessageText,
  type TelegramCallbackQuery,
} from "./telegram";

/** Reconstructs UUID from 32-hex actionId in callback_data. */
function parseCallbackActionId(rawHex: string): string {
  if (rawHex.length !== 32) return rawHex;
  return `${rawHex.slice(0, 8)}-${rawHex.slice(8, 12)}-${rawHex.slice(12, 16)}-${rawHex.slice(16, 20)}-${rawHex.slice(20)}`;
}

/** Handle action-confirm button clicks. Returns true if handled. */
export async function handleTelegramActionCallback(input: {
  token: string;
  publicKey: string;
  productId: string;
  callback: TelegramCallbackQuery;
}): Promise<boolean> {
  const { token, publicKey, productId, callback: cb } = input;
  const data = cb.data ?? "";
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  const telegramUserId = cb.from?.id != null ? String(cb.from.id) : null;

  if ((!data.startsWith("a:") && !data.startsWith("run_action:")) || !chatId || !messageId) {
    await answerTelegramCallbackQuery(token, cb.id);
    return true;
  }

  let actionId: string;
  let paramsStr: string;

  if (data.startsWith("a:")) {
    const parts = data.slice(2).split(":");
    actionId = parseCallbackActionId(parts[0] ?? "");
    paramsStr = parts.slice(1).join(":");
  } else {
    const parts = data.split(":");
    actionId = parts[1] ?? "";
    paramsStr = parts.slice(2).join(":");
  }

  await answerTelegramCallbackQuery(token, cb.id, "Running action...");

  const check = await getEnabledActionForPublicKey(publicKey, actionId);
  if (!check.ok) {
    await editTelegramMessageText(token, chatId, messageId, `Action failed: ${check.error}`);
    return true;
  }

  let parsedParams: Record<string, unknown> | undefined;
  if (paramsStr) {
    try {
      parsedParams = JSON.parse(paramsStr);
    } catch {
      parsedParams = { value: paramsStr };
    }
  }

  const link = telegramUserId ? await getTelegramChannelLink(productId, telegramUserId) : null;
  if (!link) {
    await editTelegramMessageText(
      token,
      chatId,
      messageId,
      "Connect your wallet first. Send /connect then open the link.",
    );
    return true;
  }

  const res = await runProductAction({
    actionId: check.actionId,
    params: parsedParams ?? paramsStr,
    payerUserId: link.userId,
    agentId: link.agentId,
  });

  if (res.ok) {
    const paid = res.paid ? `\nPaid: ${res.paid} USDC` : "";
    const proof = res.txHash ? `\nTx: \`${res.txHash}\`` : "";
    const output = res.body ? `\n\n\`\`\`\n${res.body.slice(0, 1500)}\n\`\`\`` : "";
    await editTelegramMessageText(
      token,
      chatId,
      messageId,
      `Action executed successfully!${paid}${proof}${output}`,
      { parseMode: "Markdown" },
    );
  } else {
    await editTelegramMessageText(
      token,
      chatId,
      messageId,
      `Action failed: ${res.error ?? "Unknown error"}`,
    );
  }

  return true;
}
