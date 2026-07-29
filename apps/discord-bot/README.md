# Tael Discord bot

Call Tael marketplace capabilities from Discord. A community member runs a slash
command, the bot's Card pays per call in USDC, and the result comes back in the
channel with an on-chain proof link.

```
/tael list                          → capabilities you can call here
/tael search query:weather          → search the marketplace
/tael call capability:Cat Facts     → run it (the bot pays per call)
/tael call capability:Weather Now params:city=London
```

## Guardrails

The bot spends from **one shared Card**, so it is deliberately locked down:

- **Data capabilities only:** an allowlist in `src/config.ts`. There is **no
  `pay` / `swap`**, so no one can move USDC out of the Card with a command.
- **Per-user rate limit** (`RATE_LIMIT_PER_MIN`, default 5/min).
- **Daily call cap** (`DAILY_CALL_CAP`, default 500) across all users.
- The Card's own **per-call and daily spend caps** still bound everything at the
  protocol level.

## Setup

1. **Create the Discord app**: <https://discord.com/developers/applications> →
   New Application. Copy the **Application ID** (`DISCORD_CLIENT_ID`). Under
   **Bot**, reset and copy the **token** (`DISCORD_TOKEN`).
2. **Invite it** to your server with the `applications.commands` (and `bot`)
   scopes:
   `https://discord.com/oauth2/authorize?client_id=<CLIENT_ID>&scope=bot+applications.commands`
3. **Create a Tael key** (dashboard → API Keys) linked to a **funded Card**, and
   set `TAEL_KEY`. Keep the Card on **testnet** for a public playground.
4. Copy `.env.example` → `.env` and fill it in. Set `DISCORD_GUILD_ID` to your
   server id for **instant** command registration while testing.

## Run

```bash
pnpm --filter discord-bot dev     # watch mode
# or
pnpm --filter discord-bot build && pnpm --filter discord-bot start
```

## Deploy

A bot is a long-lived process, so deploy it as a **worker**, not a web service.

- **Render** → New → **Background Worker**, repo root, build
  `pnpm install && pnpm --filter discord-bot build`, start
  `pnpm --filter discord-bot start`, and set the env vars.
- **Docker**: `docker build -f apps/discord-bot/Dockerfile -t tael-discord-bot .`
