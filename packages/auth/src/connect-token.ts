import { SignJWT, jwtVerify } from "jose";
import { secretKey } from "./secret";

const CONNECT_TTL = "15m";

export interface TelegramConnectPayload {
  channel: "telegram";
  externalUserId: string;
  productId: string;
  productPublicKey: string;
  productName: string;
}

/** Mint a short-lived token for Telegram → web wallet connect. */
export async function createTelegramConnectToken(
  payload: Omit<TelegramConnectPayload, "channel">,
  secret: string,
): Promise<string> {
  return new SignJWT({
    channel: "telegram",
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

/** Verify a Telegram connect token. Throws on invalid/expired. */
export async function verifyTelegramConnectToken(
  token: string,
  secret: string,
): Promise<TelegramConnectPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret));
  if (payload.channel !== "telegram") throw new Error("Invalid connect token channel.");
  const externalUserId = typeof payload.externalUserId === "string" ? payload.externalUserId : "";
  const productId = typeof payload.productId === "string" ? payload.productId : "";
  const productPublicKey =
    typeof payload.productPublicKey === "string" ? payload.productPublicKey : "";
  const productName = typeof payload.productName === "string" ? payload.productName : "";
  if (!externalUserId || !productId || !productPublicKey) {
    throw new Error("Invalid connect token payload.");
  }
  return {
    channel: "telegram",
    externalUserId,
    productId,
    productPublicKey,
    productName,
  };
}
