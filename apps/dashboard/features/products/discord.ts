/**
 * Discord Bot API helpers for per-product agents.
 * Uses fetch + Node crypto (no discord.js) so the dashboard stays serverless-friendly.
 */

import { createPublicKey, verify as cryptoVerify } from "node:crypto";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export const DISCORD_INTERACTION_PING = 1;
export const DISCORD_INTERACTION_APPLICATION_COMMAND = 2;
export const DISCORD_INTERACTION_MESSAGE_COMPONENT = 3;

export const DISCORD_CALLBACK_PONG = 1;
export const DISCORD_CALLBACK_CHANNEL_MESSAGE = 4;
export const DISCORD_CALLBACK_DEFERRED_CHANNEL_MESSAGE = 5;
export const DISCORD_CALLBACK_UPDATE_MESSAGE = 7;

export interface DiscordBotUser {
  id: string;
  username: string;
  bot?: boolean;
}

export interface DiscordInteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
}

export interface DiscordInteractionData {
  id?: string;
  name?: string;
  custom_id?: string;
  options?: DiscordInteractionOption[];
}

export interface DiscordInteraction {
  id: string;
  type: number;
  token: string;
  application_id?: string;
  guild_id?: string;
  channel_id?: string;
  data?: DiscordInteractionData;
  member?: { user?: { id: string; username?: string; bot?: boolean } };
  user?: { id: string; username?: string; bot?: boolean };
}

/** Verify Discord Ed25519 request signature (Interactions Endpoint security). */
export function verifyDiscordRequest(
  publicKeyHex: string,
  signatureHex: string,
  timestamp: string,
  rawBody: string,
): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.from(publicKeyHex, "hex"),
      ]),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}

/** Validate bot token and return the bot user. */
export async function getDiscordBotInfo(
  token: string,
): Promise<{ ok: boolean; id?: string; username?: string; error?: string }> {
  try {
    const res = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      method: "GET",
      headers: {
        authorization: `Bot ${token}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as
      (DiscordBotUser & { message?: string }) | null;
    if (!res.ok || !data?.id || !data.username) {
      return {
        ok: false,
        error: data?.message ?? "Invalid Discord bot token.",
      };
    }
    if (data.bot === false) {
      return { ok: false, error: "Token must belong to a Discord bot application." };
    }
    return { ok: true, id: data.id, username: data.username };
  } catch {
    return { ok: false, error: "Could not reach Discord API." };
  }
}

/** Register the product /ask slash command on this application. */
export async function registerDiscordAskCommand(
  token: string,
  applicationId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${DISCORD_API_BASE}/applications/${applicationId}/commands`, {
      method: "POST",
      headers: {
        authorization: `Bot ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "ask",
        description: "Ask this product agent a question",
        options: [
          {
            name: "question",
            description: "What do you want to know?",
            type: 3,
            required: true,
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as { message?: string; code?: number } | null;
    if (!res.ok) {
      return { ok: false, error: data?.message ?? "Failed to register /ask command." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not register Discord slash commands." };
  }
}

/** Best-effort cleanup of the /ask command on disconnect. */
export async function deleteDiscordAskCommand(token: string, applicationId: string): Promise<void> {
  try {
    const listRes = await fetch(`${DISCORD_API_BASE}/applications/${applicationId}/commands`, {
      method: "GET",
      headers: {
        authorization: `Bot ${token}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!listRes.ok) return;
    const commands = (await listRes.json().catch(() => [])) as { id: string; name: string }[];
    const ask = commands.find((c) => c.name === "ask");
    if (!ask) return;
    await fetch(`${DISCORD_API_BASE}/applications/${applicationId}/commands/${ask.id}`, {
      method: "DELETE",
      headers: { authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // best-effort
  }
}

/** Follow up on a deferred interaction with the final reply. */
export async function editDiscordInteractionResponse(
  applicationId: string,
  interactionToken: string,
  content: string,
  components?: unknown[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = { content: content.slice(0, 2000) };
    if (components) body.components = components;

    const res = await fetch(
      `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, error: data?.message ?? "Failed to update Discord reply." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not send Discord reply." };
  }
}

/** Build the OAuth invite URL for a product bot. */
export function buildDiscordInviteUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "bot applications.commands",
    permissions: "2147485696", // Send Messages + Use Application Commands
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/** Extract a slash-command string option by name. */
export function getDiscordOptionString(
  interaction: DiscordInteraction,
  name: string,
): string | null {
  const opt = interaction.data?.options?.find((o) => o.name === name);
  return typeof opt?.value === "string" ? opt.value : null;
}
