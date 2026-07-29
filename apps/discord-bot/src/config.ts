// Bot configuration: env (validated at startup) plus the static allowlist of
// capabilities the bot is willing to call.

export interface BotConfig {
  discordToken: string;
  /** Application (client) id, used to register slash commands. */
  clientId: string;
  /** Optional: register commands to one guild (instant) instead of globally. */
  guildId?: string;
  /** Tael API key linked to the funded Card the bot spends from. */
  taelKey: string;
  /** Override the gateway base URL (defaults to the SDK's testnet gateway). */
  taelBaseUrl?: string;
  /** Which network's explorer to link proofs to. */
  network: "testnet" | "public";
  /** Guardrail: max calls per user per minute. */
  perUserPerMinute: number;
  /** Guardrail: max total calls the bot will make per day. */
  dailyCallCap: number;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): BotConfig {
  return {
    discordToken: required("DISCORD_TOKEN"),
    clientId: required("DISCORD_CLIENT_ID"),
    guildId: process.env.DISCORD_GUILD_ID || undefined,
    taelKey: required("TAEL_KEY"),
    taelBaseUrl: process.env.TAEL_BASE_URL || undefined,
    network: process.env.TAEL_NETWORK === "mainnet" ? "public" : "testnet",
    perUserPerMinute: Number(process.env.RATE_LIMIT_PER_MIN ?? "5"),
    dailyCallCap: Number(process.env.DAILY_CALL_CAP ?? "500"),
  };
}

/** A capability the bot will call, with the params it expects. */
export interface AllowedCap {
  slug: string;
  label: string;
  hint?: string;
}

/**
 * The ONLY capabilities the bot will call. Data lookups only, deliberately no
 * `pay` / `swap`, so no one can move USDC out of the shared Card with a command.
 */
export const ALLOWED: AllowedCap[] = [
  { slug: "cat-facts-ee8103", label: "Cat Facts" },
  { slug: "weather-now-2ddf45", label: "Weather Now", hint: "city=London" },
  { slug: "fx-rates/rates", label: "FX Rates", hint: "base=USD" },
  { slug: "stellar/account", label: "Stellar · Account", hint: "address=G…" },
  { slug: "stellar/balance", label: "Stellar · Balance", hint: "address=G…" },
  { slug: "stellar/portfolio", label: "Stellar · Portfolio", hint: "address=G…" },
  {
    slug: "stellar/quote",
    label: "Stellar · Quote",
    hint: "source=USDC:<issuer>&dest=native&amount=100",
  },
  { slug: "stellar/explain", label: "Stellar · Explain", hint: "hash=<64-hex tx>" },
  { slug: "trustline", label: "TrustLine (credit)" },
];

/** True only if the slug is allowlisted AND is not a money-moving op. */
export function isAllowed(slug: string): boolean {
  return ALLOWED.some((a) => a.slug === slug) && !/(^|\/)(pay|swap)\b/i.test(slug);
}

export function explorerTx(hash: string, network: "testnet" | "public"): string {
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}
