import { SignJWT, jwtVerify } from "jose";
import { secretKey } from "./secret";

const CONNECT_TTL = "15m";

export type ConnectChannel = "telegram" | "discord";

export interface ChannelConnectPayload {
  channel: ConnectChannel;
  externalUserId: string;
  productId: string;
  productPublicKey: string;
  productName: string;
}

/** @deprecated Prefer ChannelConnectPayload */
export type TelegramConnectPayload = ChannelConnectPayload & { channel: "telegram" };

async function createChannelConnectToken(
  channel: ConnectChannel,
  payload: Omit<ChannelConnectPayload, "channel">,
  secret: string,
): Promise<string> {
  return new SignJWT({
    channel,
    externalUserId: payload.externalUserId,
    productId: payload.productId,
    productPublicKey: payload.productPublicKey,
    productName: payload.productName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(CONNECT_TTL)
    .sign(secretKey(secret));
}

async function verifyChannelConnectToken(
  channel: ConnectChannel,
  token: string,
  secret: string,
): Promise<ChannelConnectPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret));
  if (payload.channel !== channel) throw new Error("Invalid connect token channel.");
  const externalUserId = typeof payload.externalUserId === "string" ? payload.externalUserId : "";
  const productId = typeof payload.productId === "string" ? payload.productId : "";
  const productPublicKey =
    typeof payload.productPublicKey === "string" ? payload.productPublicKey : "";
  const productName = typeof payload.productName === "string" ? payload.productName : "";
  if (!externalUserId || !productId || !productPublicKey) {
    throw new Error("Invalid connect token payload.");
  }
  return {
    channel,
    externalUserId,
    productId,
    productPublicKey,
    productName,
  };
}

/** Mint a short-lived token for Telegram → web wallet connect. */
export async function createTelegramConnectToken(
  payload: Omit<ChannelConnectPayload, "channel">,
  secret: string,
): Promise<string> {
  return createChannelConnectToken("telegram", payload, secret);
}

/** Verify a Telegram connect token. Throws on invalid/expired. */
export async function verifyTelegramConnectToken(
  token: string,
  secret: string,
): Promise<TelegramConnectPayload> {
  return verifyChannelConnectToken("telegram", token, secret) as Promise<TelegramConnectPayload>;
}

/** Mint a short-lived token for Discord → web wallet connect. */
export async function createDiscordConnectToken(
  payload: Omit<ChannelConnectPayload, "channel">,
  secret: string,
): Promise<string> {
  return createChannelConnectToken("discord", payload, secret);
}

/** Verify a Discord connect token. Throws on invalid/expired. */
export async function verifyDiscordConnectToken(
  token: string,
  secret: string,
): Promise<ChannelConnectPayload & { channel: "discord" }> {
  return verifyChannelConnectToken("discord", token, secret) as Promise<
    ChannelConnectPayload & { channel: "discord" }
  >;
}
