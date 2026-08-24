/** Client-safe Discord OAuth / invite URL helpers (no Node crypto). */

/** Build the OAuth invite URL for a product bot (guild install). */
export function buildDiscordInviteUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "bot applications.commands",
    permissions: "2147485696", // Send Messages + Use Application Commands
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/** Build a user-install (Add App) URL for Hermies-style DMs. */
export function buildDiscordUserInstallUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    integration_type: "1",
    scope: "applications.commands",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
