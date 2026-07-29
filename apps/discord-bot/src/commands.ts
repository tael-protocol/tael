import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { TaelError, type Tael } from "@tael/sdk";
import { ALLOWED, explorerTx, isAllowed, type BotConfig } from "./config";
import type { Guard } from "./rate-limit";

const BRAND = 0x156dfc;

/** The single `/tael` command with list / search / call subcommands. */
export const command = new SlashCommandBuilder()
  .setName("tael")
  .setDescription("Call Tael capabilities. An agent pays per call in USDC")
  .addSubcommand((s) => s.setName("list").setDescription("List the capabilities you can call here"))
  .addSubcommand((s) =>
    s
      .setName("search")
      .setDescription("Search the Tael marketplace")
      .addStringOption((o) => o.setName("query").setDescription("e.g. weather").setRequired(true)),
  )
  .addSubcommand((s) => {
    s.setName("call").setDescription("Call a capability (the bot pays per call)");
    s.addStringOption((o) => {
      o.setName("capability").setDescription("Which capability").setRequired(true);
      for (const a of ALLOWED.slice(0, 25)) o.addChoices({ name: a.label, value: a.slug });
      return o;
    });
    s.addStringOption((o) =>
      o.setName("params").setDescription("Query params, e.g. city=London").setRequired(false),
    );
    return s;
  });

export interface Ctx {
  tael: Tael;
  guard: Guard;
  network: BotConfig["network"];
}

export async function handle(i: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  switch (i.options.getSubcommand()) {
    case "list":
      return list(i);
    case "search":
      return search(i, ctx);
    case "call":
      return call(i, ctx);
  }
}

async function list(i: ChatInputCommandInteraction): Promise<void> {
  const lines = ALLOWED.map(
    (a) => `• **${a.label}** · \`${a.slug}\`${a.hint ? ` · params: \`${a.hint}\`` : ""}`,
  );
  const embed = new EmbedBuilder()
    .setTitle("Callable capabilities")
    .setDescription(lines.join("\n"))
    .setColor(BRAND)
    .setFooter({ text: "Use /tael call to run one. The bot pays per call in USDC" });
  await i.reply({ embeds: [embed] });
}

async function search(i: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await i.deferReply();
  const q = i.options.getString("query", true);
  const found = await ctx.tael.search(q);
  const lines = found
    .slice(0, 15)
    .map(
      (c) =>
        `• **${c.name}** · \`${c.slug}\` · ${Number(c.price) > 0 ? `$${c.price}/call` : "free"}`,
    );
  const embed = new EmbedBuilder()
    .setTitle(`Search: ${q}`)
    .setDescription(lines.join("\n") || "No matches.")
    .setColor(BRAND);
  await i.editReply({ embeds: [embed] });
}

async function call(i: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const slug = i.options.getString("capability", true);
  const paramsStr = i.options.getString("params") ?? "";

  // Guardrail 1: only allowlisted, data-only capabilities.
  if (!isAllowed(slug)) {
    await i.reply({
      content: "That capability isn't available here.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // Guardrail 2: per-user rate limit + daily cap.
  const gate = ctx.guard.check(i.user.id);
  if (!gate.ok) {
    await i.reply({ content: gate.reason, flags: MessageFlags.Ephemeral });
    return;
  }

  await i.deferReply(); // public: the result + on-chain proof are visible to the channel

  const query = Object.fromEntries(new URLSearchParams(paramsStr));
  try {
    const res = await ctx.tael.call(slug, Object.keys(query).length ? { query } : {});
    const body = JSON.stringify(res.data);
    const embed = new EmbedBuilder()
      .setTitle(`Ran ${slug}`)
      .setDescription("```json\n" + body.slice(0, 1500) + "\n```")
      .setColor(BRAND)
      .setFooter({ text: `Paid per call in USDC · requested by ${i.user.username}` });
    if (res.receipt?.txHash) {
      embed.addFields({
        name: "On-chain proof",
        value: `[${res.receipt.txHash.slice(0, 12)}…](${explorerTx(res.receipt.txHash, ctx.network)})`,
      });
    }
    await i.editReply({ embeds: [embed] });
  } catch (err) {
    const msg =
      err instanceof TaelError
        ? `Couldn't run it (${err.status}): ${err.message}`
        : "The call failed. Try again.";
    await i.editReply(msg);
  }
}
