import {
  createTelegramConnectToken as mintTelegramConnectToken,
  verifyTelegramConnectToken as checkTelegramConnectToken,
  type TelegramConnectPayload,
} from "@tael/auth";
import { AUTH_SECRET } from "./config";

export type { TelegramConnectPayload };

/** Mint a short-lived token for the Telegram → web wallet connect flow. */
export async function createTelegramConnectToken(
  payload: Omit<TelegramConnectPayload, "channel">,
): Promise<string> {
  return mintTelegramConnectToken(payload, AUTH_SECRET);
}

/** Verify a Telegram connect token. Throws on invalid/expired. */
export async function verifyTelegramConnectToken(token: string): Promise<TelegramConnectPayload> {
  return checkTelegramConnectToken(token, AUTH_SECRET);
}
