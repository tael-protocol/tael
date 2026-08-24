import {
  createTelegramConnectToken as mintTelegramConnectToken,
  verifyTelegramConnectToken as checkTelegramConnectToken,
  createDiscordConnectToken as mintDiscordConnectToken,
  verifyDiscordConnectToken as checkDiscordConnectToken,
  type ChannelConnectPayload,
  type TelegramConnectPayload,
} from "@tael/auth";
import { AUTH_SECRET } from "./config";

export type { ChannelConnectPayload, TelegramConnectPayload };

/** Mint a short-lived token for the Telegram → web wallet connect flow. */
export async function createTelegramConnectToken(
  payload: Omit<ChannelConnectPayload, "channel">,
): Promise<string> {
  return mintTelegramConnectToken(payload, AUTH_SECRET);
}

/** Verify a Telegram connect token. Throws on invalid/expired. */
export async function verifyTelegramConnectToken(token: string): Promise<TelegramConnectPayload> {
  return checkTelegramConnectToken(token, AUTH_SECRET);
}

/** Mint a short-lived token for the Discord → web wallet connect flow. */
export async function createDiscordConnectToken(
  payload: Omit<ChannelConnectPayload, "channel">,
): Promise<string> {
  return mintDiscordConnectToken(payload, AUTH_SECRET);
}

/** Verify a Discord connect token. Throws on invalid/expired. */
export async function verifyDiscordConnectToken(
  token: string,
): Promise<ChannelConnectPayload & { channel: "discord" }> {
  return checkDiscordConnectToken(token, AUTH_SECRET);
}
