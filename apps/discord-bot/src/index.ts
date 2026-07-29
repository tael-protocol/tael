import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from "discord.js";
import { loadConfig } from "./config";
import { makeClient } from "./tael";
import { Guard } from "./rate-limit";
import { command, handle, type Ctx } from "./commands";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const ctx: Ctx = {
    tael: makeClient(cfg.taelKey, cfg.taelBaseUrl),
    guard: new Guard(cfg.perUserPerMinute, cfg.dailyCallCap),
    network: cfg.network,
  };

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (c) => {
    // Register /tael. Guild-scoped is instant; global can take up to an hour.
    const rest = new REST().setToken(cfg.discordToken);
    const body = [command.toJSON()];
    if (cfg.guildId) {
      await rest.put(Routes.applicationGuildCommands(cfg.clientId, cfg.guildId), { body });
      console.log(`Registered /tael to guild ${cfg.guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(cfg.clientId), { body });
      console.log("Registered /tael globally (can take up to 1h to appear)");
    }
    console.log(`Tael bot ready as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand() || i.commandName !== "tael") return;
    try {
      await handle(i, ctx);
    } catch (err) {
      console.error("interaction error:", err);
      const content = "Something went wrong. Please try again.";
      if (i.deferred || i.replied) await i.editReply(content).catch(() => {});
      else await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });

  await client.login(cfg.discordToken);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
