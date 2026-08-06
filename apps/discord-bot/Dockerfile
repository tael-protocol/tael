# Build + run the Tael Discord bot from the monorepo root:
#   docker build -f apps/discord-bot/Dockerfile -t tael-discord-bot .
FROM node:22-slim
WORKDIR /app
RUN corepack enable

# Install workspace deps (needs the whole monorepo for pnpm workspaces).
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter discord-bot build

# A bot is a long-lived process, not an HTTP server.
CMD ["pnpm", "--filter", "discord-bot", "start"]
