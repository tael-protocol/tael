/**
 * Turn capability / action JSON into short human-readable chat text
 * (Discord + Telegram). Keeps proof links for on-chain results.
 */

const NETWORK = process.env.STELLAR_NETWORK === "mainnet" ? "public" : "testnet";
const STELLAR_EXPERT_TX = `https://stellar.expert/explorer/${NETWORK}/tx/`;
const STELLAR_EXPERT_ACCOUNT = `https://stellar.expert/explorer/${NETWORK}/account/`;

function shortAddr(address: string): string {
  const a = address.trim();
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatAmount(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  // Trim trailing zeros but keep some precision for tiny balances.
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 7 });
  return n.toFixed(7).replace(/\.?0+$/, "") || "0";
}

interface BalanceRow {
  asset?: string;
  code?: string;
  issuer?: string | null;
  balance?: string;
}

function formatBalanceBody(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  if (!Array.isArray(o.balances)) return null;

  // Balance endpoint always includes `address`. Other payloads (e.g. claimable)
  // also have a `balances` array — skip those here.
  const address = typeof o.address === "string" ? o.address : "";
  if (!address) return null;

  const lines: string[] = [
    `**Balances for** \`${shortAddr(address)}\``,
    `[View account ↗](${STELLAR_EXPERT_ACCOUNT}${address})`,
  ];

  const rows = o.balances as BalanceRow[];
  if (rows.length === 0) {
    lines.push("No assets found on this account.");
  } else {
    for (const row of rows) {
      const asset =
        (typeof row.asset === "string" && row.asset) ||
        (typeof row.code === "string" && row.code) ||
        "Asset";
      const bal = typeof row.balance === "string" ? formatAmount(row.balance) : "?";
      if (asset === "XLM" || asset === "native") {
        lines.push(`• **XLM:** ${bal}`);
      } else if (typeof row.issuer === "string" && row.issuer) {
        lines.push(`• **${asset}** (${shortAddr(row.issuer)}): ${bal}`);
      } else {
        lines.push(`• **${asset}:** ${bal}`);
      }
    }
  }
  return lines.join("\n");
}

function formatPayBody(body: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  if (o.action !== "pay" && o.tael_action !== "pay") return null;

  const to = typeof o.to === "string" ? o.to : "";
  const amount = typeof o.amount === "string" ? o.amount : "";
  const asset = typeof o.asset === "string" ? o.asset : "USDC";
  const fee = typeof o.fee === "string" ? o.fee : "";
  const txHash =
    (typeof o.txHash === "string" && o.txHash) || (typeof o.hash === "string" && o.hash) || "";

  const lines = ["**Payment sent**"];
  if (amount) lines.push(`• Amount: **${formatAmount(amount)} ${asset}**`);
  if (fee && Number(fee) > 0) lines.push(`• Fee: **${formatAmount(fee)} ${asset}**`);
  if (to) lines.push(`• To: \`${shortAddr(to)}\``);
  if (txHash) lines.push(`• Proof: [View on Stellar Expert ↗](${STELLAR_EXPERT_TX}${txHash})`);
  return lines.join("\n");
}

export interface FormatActionResultInput {
  ok: boolean;
  body?: string;
  paid?: string;
  txHash?: string;
  error?: string;
  /** Optional action name for the header. */
  actionName?: string;
}

/**
 * Human-readable action result for chat surfaces.
 * Uses Discord-friendly markdown (also fine in Telegram HTML if we strip later).
 */
export function formatActionResultForChat(input: FormatActionResultInput): string {
  if (!input.ok) {
    return `Action failed: ${input.error ?? "Unknown error"}`;
  }

  const parts: string[] = [];
  const name = input.actionName?.trim();
  parts.push(name ? `**${name} — done**` : "**Action executed successfully**");

  if (input.paid != null && Number(input.paid) > 0) {
    parts.push(`Paid: **${formatAmount(input.paid)} USDC** from your linked Card.`);
  } else if (input.paid != null) {
    parts.push("Free lookup — nothing charged.");
  }

  const body = input.body?.trim() ?? "";
  if (body) {
    const balance = formatBalanceBody(body);
    const pay = formatPayBody(body);
    if (balance) {
      parts.push("", balance);
    } else if (pay) {
      parts.push("", pay);
    } else {
      // Unknown JSON / text — keep a short readable clip, not a huge dump.
      const clip = body.length > 600 ? `${body.slice(0, 600)}…` : body;
      parts.push("", clip.startsWith("{") ? `\`\`\`json\n${clip}\n\`\`\`` : clip);
    }
  }

  if (input.txHash && !body.includes(input.txHash)) {
    parts.push("", `Proof: [View on Stellar Expert ↗](${STELLAR_EXPERT_TX}${input.txHash})`);
  }

  return parts.join("\n").slice(0, 1900);
}

/** Convert Discord-ish markdown links/bold to Telegram HTML. */
export function discordMarkdownToTelegramHtml(text: string): string {
  let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/```(?:json)?\n?([\s\S]*?)```/g, (_m, code: string) => `<pre>${code}</pre>`);
  return s;
}
