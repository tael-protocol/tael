/**
 * Telegram Bot API client helpers.
 * Direct REST implementation using fetch (no extra heavy npm dependencies).
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

/** Get info about the bot associated with the token. */
export async function getTelegramBotInfo(
  token: string,
): Promise<{ ok: boolean; username?: string; firstName?: string; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`, {
      method: "GET",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: { username?: string; first_name?: string };
      description?: string;
    };
    if (!res.ok || !data.ok || !data.result) {
      return { ok: false, error: data.description ?? "Invalid bot token." };
    }
    return {
      ok: true,
      username: data.result.username,
      firstName: data.result.first_name,
    };
  } catch {
    return { ok: false, error: "Could not reach Telegram API." };
  }
}

/** Set webhook URL for Telegram bot with optional secret_token header verification. */
export async function setTelegramWebhook(
  token: string,
  webhookUrl: string,
  secretToken?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = { url: webhookUrl };
    if (secretToken) {
      body.secret_token = secretToken;
    }

    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? "Failed to set webhook." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach Telegram API." };
  }
}

/** Delete webhook for Telegram bot. */
export async function deleteTelegramWebhook(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/deleteWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? "Failed to delete webhook." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach Telegram API." };
  }
}

/** Send text message (with optional inline keyboard). */
export async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  options?: {
    replyMarkup?: InlineKeyboardMarkup;
    parseMode?: "Markdown" | "HTML";
  },
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };
    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }
    if (options?.parseMode) {
      body.parse_mode = options.parseMode;
    }

    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };
    if (!res.ok || !data.ok) {
      if (options?.parseMode) {
        return sendTelegramMessage(token, chatId, text, {
          replyMarkup: options.replyMarkup,
        });
      }
      return { ok: false, error: data.description ?? "Failed to send message." };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch {
    return { ok: false, error: "Could not send Telegram message." };
  }
}

/** Edit existing Telegram message text. */
export async function editTelegramMessageText(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
  options?: {
    replyMarkup?: InlineKeyboardMarkup;
    parseMode?: "Markdown" | "HTML";
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
    };
    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }
    if (options?.parseMode) {
      body.parse_mode = options.parseMode;
    }

    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!res.ok || !data.ok) {
      if (options?.parseMode) {
        return editTelegramMessageText(token, chatId, messageId, text, {
          replyMarkup: options.replyMarkup,
        });
      }
      return { ok: false, error: data.description ?? "Failed to edit message." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not edit Telegram message." };
  }
}

/** Acknowledge callback query from inline keyboard click. */
export async function answerTelegramCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    return { ok: data.ok, error: data.description };
  } catch {
    return { ok: false, error: "Could not answer callback query." };
  }
}
