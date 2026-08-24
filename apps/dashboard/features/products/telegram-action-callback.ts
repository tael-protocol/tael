import { getEnabledActionForPublicKey, runProductAction } from "./run-product-action";
import { getTelegramChannelLink } from "./channel-links";
import { consumePendingActionConfirm } from "./pending-action-confirms";
import { parseActionCallbackData } from "./pending-callback";
import {
  answerTelegramCallbackQuery,
  editTelegramMessageText,
  type TelegramCallbackQuery,
} from "./telegram";

/** Reconstructs UUID from 32-hex actionId in legacy callback_data. */
function parseCallbackActionId(rawHex: string): string {
  const hex = rawHex.replace(/-/g, "");
  if (hex.length !== 32) return rawHex;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

  const parsed = parseActionCallbackData(data);
  if (!parsed || !chatId || !messageId) {
    await answerTelegramCallbackQuery(token, cb.id);
    return true;
  }

  await answerTelegramCallbackQuery(token, cb.id, "Running action...");

  let actionId: string;
  let actionParams: string | Record<string, unknown> | null | undefined;

  if (parsed.kind === "pending") {
    const pending = await consumePendingActionConfirm({
      token: parsed.token,
      channel: "telegram",
      externalUserId: telegramUserId,
    });
    if (!pending || pending.productId !== productId) {
      await editTelegramMessageText(
        token,
        chatId,
        messageId,
        "This confirmation expired. Ask again to get a new button.",
      );
      return true;
    }
    actionId = pending.actionId;
    actionParams = pending.params;
  } else {
    actionId = parseCallbackActionId(parsed.actionIdHex);
    if (parsed.paramsStr) {
      try {
        actionParams = JSON.parse(parsed.paramsStr) as Record<string, unknown>;
      } catch {
        actionParams = parsed.paramsStr;
      }
    }
  }

  const check = await getEnabledActionForPublicKey(publicKey, actionId);
  if (!check.ok) {
    await editTelegramMessageText(token, chatId, messageId, `Action failed: ${check.error}`);
    return true;
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
    params: actionParams,
    payerUserId: link.userId,
    agentId: link.agentId,
  });

  if (res.ok) {
    const paid = res.paid ? `\nPaid: ${res.paid} USDC` : "";
    const proof = res.txHash ? `\nTx: <code>${res.txHash}</code>` : "";
    const safeBody = res.body
      ? `\n\n<pre>${res.body
          .slice(0, 1500)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</pre>`
      : "";
    await editTelegramMessageText(
      token,
      chatId,
      messageId,
      `Action executed successfully!${paid}${proof}${safeBody}`,
      { parseMode: "HTML" },
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
