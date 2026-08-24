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

/** Register product slash commands (ask + wallet) with DM support. */
export async function registerDiscordAskCommand(
  token: string,
  applicationId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Bulk overwrite keeps guild + DM commands in sync.
    // contexts: 0=Guild, 1=Bot DM, 2=Private channel
    // integration_types: 0=Guild install, 1=User install
    const commands = [
      {
        name: "ask",
        description: "Ask this product agent a question (use DMs for paid actions)",
        dm_permission: true,
        integration_types: [0, 1],
        contexts: [0, 1, 2],
        options: [
          {
            name: "question",
            description: "What do you want to know?",
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: "connect",
        description: "Link your Stellar wallet + Card for paid actions (DM recommended)",
        dm_permission: true,
        integration_types: [0, 1],
        contexts: [0, 1, 2],
      },
      {
        name: "wallet",
        description: "Check whether your wallet is linked to this bot",
        dm_permission: true,
        integration_types: [0, 1],
        contexts: [0, 1, 2],
      },
      {
        name: "disconnect",
        description: "Unlink your wallet from this bot",
        dm_permission: true,
        integration_types: [0, 1],
        contexts: [0, 1, 2],
      },
    ];

    const res = await fetch(`${DISCORD_API_BASE}/applications/${applicationId}/commands`, {
      method: "PUT",
      headers: {
        authorization: `Bot ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as { message?: string; code?: number } | null;
    if (!res.ok) {
      return { ok: false, error: data?.message ?? "Failed to register Discord commands." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not register Discord slash commands." };
  }
}

/** Best-effort cleanup of product commands on disconnect. */
export async function deleteDiscordAskCommand(token: string, applicationId: string): Promise<void> {
  try {
    await fetch(`${DISCORD_API_BASE}/applications/${applicationId}/commands`, {
      method: "PUT",
      headers: {
        authorization: `Bot ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([]),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // best-effort
  }
}

/** True when the interaction is a bot DM (not a server channel). */
export function isDiscordDm(interaction: DiscordInteraction): boolean {
  return !interaction.guild_id;
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

export { buildDiscordInviteUrl, buildDiscordUserInstallUrl } from "./discord-urls";

/** Extract a slash-command string option by name. */
export function getDiscordOptionString(
  interaction: DiscordInteraction,
  name: string,
): string | null {
  const opt = interaction.data?.options?.find((o) => o.name === name);
  return typeof opt?.value === "string" ? opt.value : null;
}
