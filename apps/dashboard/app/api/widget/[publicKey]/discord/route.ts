import { after } from "next/server";
import { getProductByPublicKey } from "../../../../../features/products/queries";
import {
  DISCORD_CALLBACK_DEFERRED_CHANNEL_MESSAGE,
  DISCORD_CALLBACK_PONG,
  DISCORD_INTERACTION_APPLICATION_COMMAND,
  DISCORD_INTERACTION_MESSAGE_COMPONENT,
  DISCORD_INTERACTION_PING,
  getDiscordOptionString,
  isDiscordDm,
  verifyDiscordRequest,
  type DiscordInteraction,
} from "../../../../../features/products/discord";
import {
  handleDiscordActionConfirm,
  handleDiscordAsk,
} from "../../../../../features/products/discord-chat";
import { handleDiscordWalletCommand } from "../../../../../features/products/discord-wallet-commands";
import { createRateLimiter } from "../../../../../features/products/widget-chat";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowRequest = createRateLimiter(30, 60_000);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request, context: { params: Promise<{ publicKey: string }> }) {
  const { publicKey: rawKey } = await context.params;
  const publicKey = decodeURIComponent(rawKey ?? "").trim();
  if (!publicKey) return new Response("Missing public key.", { status: 400 });

  // Read body first so signature verify can start ASAP after product lookup.
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();

  const product = await getProductByPublicKey(publicKey);
  if (!product) return new Response("Agent not found.", { status: 404 });

  const settings = (product.settings as Record<string, unknown>) ?? {};
  const enabled = settings.discordBotEnabled !== false;
  const discordPublicKey =
    typeof settings.discordPublicKey === "string" ? settings.discordPublicKey : null;
  const applicationId =
    typeof settings.discordClientId === "string" ? settings.discordClientId : null;

  if (!discordPublicKey || !enabled) {
    return new Response("Discord bot is not configured or disabled for this agent.", {
      status: 400,
    });
  }

  if (
    !signature ||
    !timestamp ||
    !verifyDiscordRequest(discordPublicKey, signature, timestamp, rawBody)
  ) {
    return new Response("Invalid request signature.", { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction;
  } catch {
    return new Response("Invalid payload.", { status: 400 });
  }

  // Discord requires PONG within ~3s when saving the Interactions URL.
  if (interaction.type === DISCORD_INTERACTION_PING) {
    return jsonResponse({ type: DISCORD_CALLBACK_PONG });
  }

  if (!applicationId) {
    return jsonResponse({
      type: 4,
      data: { content: "Discord bot is missing its Application ID. Reconnect in Tael Studio." },
    });
  }

  const isDm = isDiscordDm(interaction);
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id ?? null;
  const dashboardBase = (
    process.env.NEXT_PUBLIC_DASHBOARD_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");

  if (interaction.type === DISCORD_INTERACTION_MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id ?? "";
    if (!customId.startsWith("c:")) {
      return jsonResponse({
        type: 4,
        data: { content: "Unknown button.", flags: 64 },
      });
    }

    const pendingToken = customId.slice(2).trim();

    after(() =>
      handleDiscordActionConfirm(
        publicKey,
        product.id,
        applicationId,
        interaction.token,
        pendingToken,
        discordUserId,
        isDm,
      ),
    );
    return jsonResponse({ type: DISCORD_CALLBACK_DEFERRED_CHANNEL_MESSAGE });
  }

  if (interaction.type === DISCORD_INTERACTION_APPLICATION_COMMAND) {
    const commandName = interaction.data?.name ?? "";

    if (commandName === "connect" || commandName === "wallet" || commandName === "disconnect") {
      after(() =>
        handleDiscordWalletCommand({
          applicationId,
          interactionToken: interaction.token,
          command: commandName,
          discordUserId,
          product,
          dashboardBase,
          isDm,
        }),
      );
      return jsonResponse({ type: DISCORD_CALLBACK_DEFERRED_CHANNEL_MESSAGE });
    }

    if (commandName !== "ask") {
      return jsonResponse({
        type: 4,
        data: { content: "Unknown command.", flags: 64 },
      });
    }

    const question = getDiscordOptionString(interaction, "question")?.trim() ?? "";
    if (!question) {
      return jsonResponse({
        type: 4,
        data: { content: "Please include a question.", flags: 64 },
      });
    }

    const userId = discordUserId ?? "anon";
    if (!allowRequest(`${publicKey}:${userId}`)) {
      return jsonResponse({
        type: 4,
        data: { content: "Too many requests. Please wait a minute.", flags: 64 },
      });
    }

    after(() =>
      handleDiscordAsk(product, applicationId, interaction.token, question, discordUserId, isDm),
    );
    return jsonResponse({ type: DISCORD_CALLBACK_DEFERRED_CHANNEL_MESSAGE });
  }

  return jsonResponse({ type: 4, data: { content: "Unsupported interaction.", flags: 64 } });
}
