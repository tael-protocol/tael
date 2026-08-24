"use server";

import {
  agents,
  and,
  decryptSecret,
  eq,
  gte,
  payments as paymentsTable,
  sql,
  wallets,
} from "@tael/database";
import { Money } from "@tael/types";
import {
  buildSignedPayment,
  buildSignedSwap,
  createStellarSettlement,
  type SwapAsset,
  TAEL_MEMO,
} from "@tael/stellar";
import { db } from "../../lib/db";
import { getCurrentUser } from "../capabilities/current-user";
import { fetchAccountBalances, fetchUsdcBalance } from "./balance";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const STELLAR_NETWORK = process.env.STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
// TrustLine underwriting API — https://github.com/TechnicallyKiller/TrustLine.
// Unset (default) means no wallet has a credit line to draw against; the
// balance check below then behaves exactly as it did before this change.
const TRUSTLINE_API = process.env.TRUSTLINE_API;
const HORIZON_URL = process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
// Action settlement config (the Pay action and future on-chain actions).
const USDC_ISSUER =
  process.env.USDC_ISSUER ?? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const FEE_ADDRESS = process.env.TAEL_FEE_ADDRESS ?? "";
// Tael's cut of an action, in basis points of the amount sent (100 = 1%).
const ACTION_FEE_BPS = Number(process.env.TAEL_ACTION_FEE_BPS ?? "100");

/** Tael's fee for sending `amount` USDC, as a 7-decimal string (Stellar USDC
 *  precision). Zero when no fee wallet is set or the fee rounds to nothing. */
function actionFee(amount: string): string {
  if (!FEE_ADDRESS || !(ACTION_FEE_BPS > 0)) return "0";
  return ((Number(amount) * ACTION_FEE_BPS) / 10_000).toFixed(7);
}

interface Requirement {
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: { code: string; issuer: string };
  fee?: { payTo: string; amount: string };
}

export interface RunResult {
  ok: boolean;
  /** HTTP status the capability returned. */
  status?: number;
  /** The capability's response body (text). */
  body?: string;
  /** Total USDC the agent paid for this call. */
  paid?: string;
  /** USDC drawn from TrustLine credit to cover a shortfall on this call, if any. */
  borrowed?: string;
  /** The Stellar settlement tx hash, for an on-chain proof link. */
  txHash?: string;
  error?: string;
}

/**
 * Draw `shortfallUsdc` of TrustLine credit into this agent's own wallet, if
 * (and only if) the agent already has a live TrustLine credit line — never
 * registers or underwrites one on the fly, since that's a deliberate decision
 * the wallet owner should take (see the SDK's `onboard()`), not something a
 * single paid call should trigger implicitly. Best-effort: any failure
 * (no TRUSTLINE_API configured, no credit line, insufficient limit, RPC error)
 * just returns `false` and the caller falls through to the existing
 * "not enough USDC" error — this can never make a call fail that would have
 * succeeded anyway.
 */
async function tryDrawTrustLineCredit(secretEnc: string, shortfallUsdc: string): Promise<boolean> {
  if (!TRUSTLINE_API) return false;
  try {
    const { TrustLineAgent } = await import("@trustline-agents/agent-sdk");
    const tl = new TrustLineAgent(decryptSecret(secretEnc), { apiBaseUrl: TRUSTLINE_API });
    const available = await tl.availableCreditUsdc();
    if (available < Number(shortfallUsdc)) return false;
    await tl.borrow(Number(shortfallUsdc));
    return true;
  } catch (error) {
    console.error("[run] TrustLine credit draw failed (falling back to balance error):", error);
    return false;
  }
}

/**
 * The responsible other half of the credit relationship: pay DOWN what the
 * agent owes TrustLine, out of spare cash, whenever it has some. Borrow and
 * repay are separate on-chain events — you repay LATER, from revenue the work
 * earned, not from the cash you just spent — so this runs opportunistically:
 * after any successful call, if the agent now holds cash above a working buffer
 * and still owes TrustLine, it repays the smaller of {what it owes, its spare}.
 *
 * Same two consent gates as borrowing (TRUSTLINE_API + policy.allowCreditDraw):
 * an owner who opted this agent into taking on debt has, by the same choice,
 * authorized it to service that debt autonomously. `bufferUsdc` is the float we
 * never touch — set it to the agent's max-per-call so it always keeps enough to
 * make one more purchase. Fully best-effort: any failure just leaves the debt
 * open (repaid on a later call), and NEVER affects the call that already
 * succeeded — this is called after the response is in hand.
 */
async function maybeRepayTrustLineCredit(secretEnc: string, bufferUsdc: string): Promise<void> {
  if (!TRUSTLINE_API) return;
  try {
    const { TrustLineAgent } = await import("@trustline-agents/agent-sdk");
    const tl = new TrustLineAgent(decryptSecret(secretEnc), { apiBaseUrl: TRUSTLINE_API });

    // What does it owe right now (principal + accrued interest)?
    const state = await tl.vaultState();
    const owed = Number(state.amountOwedUsdc);
    if (!(owed > 0)) return; // nothing outstanding — done

    // Only ever repay from SPARE cash above the working buffer, so we never
    // starve the agent of the float it needs to keep operating.
    const bal = await tl.usdcBalanceUsdc();
    const spare = bal - Number(bufferUsdc);
    if (!(spare > 0)) return; // earned nothing spare — repay on a later call

    const repayAmt = Math.min(owed, spare);
    // Round down to USDC precision (7dp) so we never over-request by a rounding dust.
    const amount = Math.floor(repayAmt * 1e7) / 1e7;
    if (!(amount > 0)) return;
    await tl.repay(amount);
  } catch (error) {
    console.error("[run] TrustLine repay skipped (debt stays open for a later call):", error);
  }
}

/** Sum the total (amount + fee) this wallet paid in the last 24h, from the ledger. */
async function spentLast24h(payer: string): Promise<Money> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${paymentsTable.amount} + ${paymentsTable.fee}), 0)`,
    })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.payer, payer), gte(paymentsTable.createdAt, since)));
  return Money.parse(row?.total ?? "0");
}

/**
 * Run a capability by paying for it FROM an agent's hot wallet. Enforces the
 * agent's spending policy (max-per-call + rolling 24h limit) BEFORE signing, so
 * a runaway agent can never exceed the caps the owner set. The signing key is
 * decrypted only here, on the server, and never leaves it.
 */
export async function runCapability(input: {
  agentId: string;
  slug: string;
  /** Optional operation slug: calls `/c/<slug>/<operation>` and pays its price. */
  operation?: string;
  /** HTTP method for the call (defaults to GET). */
  method?: string;
  /** Request body to forward to the capability (e.g. the tool selector for MCP). */
  body?: string;
  /** Query string for GET calls (e.g. `address=G…`), appended to the URL. */
  query?: string;
  /**
   * When set, pay as this user (must own the Card). Used by Telegram/Discord
   * channel runners that have no browser session cookie.
   */
  ownerId?: string;
}): Promise<RunResult> {
  let ownerId = input.ownerId;
  if (!ownerId) {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };
    ownerId = user.id;
  }

  const [agent] = await db
    .select({
      policy: agents.policy,
      address: wallets.address,
      secretEnc: wallets.secretEnc,
    })
    .from(agents)
    .innerJoin(wallets, eq(agents.walletId, wallets.id))
    .where(and(eq(agents.id, input.agentId), eq(agents.ownerId, ownerId)))
    .limit(1);

  if (!agent?.secretEnc) return { ok: false, error: "Agent wallet not found." };
  // Narrow secretEnc to `string` once, here — `agent.secretEnc` on its own
  // narrows fine after the guard above, but passing the whole `agent` object
  // into a helper typed against a stricter shape does not carry that
  // narrowing through, so tryDrawTrustLineCredit takes `secretEnc` explicitly.
  const secretEnc = agent.secretEnc;

  const base = input.operation
    ? `${API_URL}/c/${input.slug}/${input.operation}`
    : `${API_URL}/c/${input.slug}`;
  // Append the caller-provided query string (e.g. ?address=G…) for GET-style ops.
  const qs = input.query?.trim().replace(/^\?/, "");
  const url = qs ? `${base}?${qs}` : base;
  const method = (input.method || "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && Boolean(input.body?.trim());
  const bodyInit = hasBody
    ? {
        body: input.body,
        headers: { "content-type": "application/json" } as Record<string, string>,
      }
    : { headers: {} as Record<string, string> };

  // 1. Ask the gateway what this call costs (the 402 challenge).
  let req: Requirement;
  try {
    const res = await fetch(url, { cache: "no-store" });
    // Free operation (price 0): the gateway proxies instead of returning 402.
    // Nothing to sign — just make the real call with the intended method + body.
    if (res.status !== 402) {
      const direct = await fetch(url, {
        method,
        cache: "no-store",
        ...(hasBody ? { body: input.body, headers: bodyInit.headers } : {}),
      });
      const body = await direct.text();
      if (!direct.ok) {
        return { ok: false, status: direct.status, body, error: friendlyError(direct.status) };
      }
      // Action ops return a `tael_action` intent to SIGN, not data. If we get
      // one, the agent's card signs it and submits it on-chain (with Tael's fee
      // baked into the same transaction), after enforcing the spending policy.
      const pay = parsePayIntent(body);
      if (pay) return runPayAction(pay, agent.address, agent.policy, secretEnc);
      const swap = parseSwapIntent(body);
      if (swap) return runSwapAction(swap, agent.address, agent.policy, secretEnc);
      return { ok: true, status: direct.status, body, paid: "0" };
    }
    const body = (await res.json()) as { accepts: Requirement[] };
    if (!body.accepts?.[0]) return { ok: false, error: "Invalid payment challenge." };
    req = body.accepts[0];
  } catch {
    return { ok: false, error: "Could not reach the capability." };
  }

  // 2. Total price = builder share + fee.
  const total = req.fee
    ? Money.parse(req.maxAmountRequired).add(Money.parse(req.fee.amount))
    : Money.parse(req.maxAmountRequired);

  // 3. Enforce the spending policy BEFORE spending anything.
  if (agent.policy) {
    const maxPerCall = Money.parse(agent.policy.maxPerCall);
    if (total.isGreaterThan(maxPerCall)) {
      return {
        ok: false,
        error: `Over the per-call cap ($${total.toDecimalString()} > $${agent.policy.maxPerCall}).`,
      };
    }
    const dailyLimit = Money.parse(agent.policy.dailyLimit);
    const projected = (await spentLast24h(agent.address)).add(total);
    if (projected.isGreaterThan(dailyLimit)) {
      return { ok: false, error: `Would exceed the daily limit of $${agent.policy.dailyLimit}.` };
    }
  }

  // 3b. Make sure the wallet actually holds enough USDC. If it's short, and the
  // owner has opted THIS agent into credit (policy.allowCreditDraw), try a
  // TrustLine credit draw before failing — same "the agent never decides to
  // borrow, it just transacts" model as TrustLine's own payWithCredit, just
  // transplanted into this runner. Two gates, both off by default: the
  // TRUSTLINE_API env var (deployment-wide) AND the per-agent policy flag
  // (owner's explicit consent for this specific agent to take on debt).
  // Wallets that opt out, have no credit line, or hit any failure just see the
  // same shortfall and the same error as today — this never blocks a call that
  // would otherwise have failed anyway.
  let borrowed: string | undefined;
  let { usdc } = await fetchUsdcBalance(agent.address);
  if (
    agent.policy?.allowCreditDraw &&
    Money.parse(total.toDecimalString()).isGreaterThan(Money.parse(usdc))
  ) {
    const shortfall = total.subtract(Money.parse(usdc));
    const drew = await tryDrawTrustLineCredit(secretEnc, shortfall.toDecimalString());
    if (drew) {
      borrowed = shortfall.toDecimalString();
      usdc = (await fetchUsdcBalance(agent.address)).usdc;
    }
  }
  if (Money.parse(total.toDecimalString()).isGreaterThan(Money.parse(usdc))) {
    return {
      ok: false,
      error: `Not enough USDC. This agent has $${usdc}, the call costs $${total.toDecimalString()}. Fund it first.`,
    };
  }

  // 4. Sign the payment from the agent's hot wallet.
  let xPayment: string;
  try {
    const legs = [{ to: req.payTo, amount: req.maxAmountRequired }];
    if (req.fee) legs.push({ to: req.fee.payTo, amount: req.fee.amount });
    const xdr = await buildSignedPayment({
      secret: decryptSecret(agent.secretEnc),
      network: STELLAR_NETWORK,
      horizonUrl: HORIZON_URL,
      usdcIssuer: req.asset.issuer,
      legs,
      memo: TAEL_MEMO,
    });
    xPayment = Buffer.from(
      JSON.stringify({
        x402Version: 1,
        scheme: "exact",
        network: req.network,
        payload: { transaction: xdr },
      }),
      "utf8",
    ).toString("base64");
  } catch (error) {
    console.error("[run] signing failed:", error);
    return { ok: false, error: "Could not sign the payment (is the wallet funded?)." };
  }

  // 5. Retry the call with the payment proof (forwarding the method + body).
  try {
    const res = await fetch(url, {
      method,
      headers: { "X-PAYMENT": xPayment, ...bodyInit.headers },
      cache: "no-store",
      ...(hasBody ? { body: input.body } : {}),
    });
    const body = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, body, error: friendlyError(res.status) };
    }
    // Call succeeded and the response is in hand. If this agent carries a
    // TrustLine balance and now holds spare cash, opportunistically pay it down
    // — the responsible other half of the credit relationship. Gated on the
    // same opt-in as borrowing; best-effort so it can never affect the result
    // we're about to return. Buffer = the per-call cap so it keeps enough for
    // one more purchase (default to the price we just paid if no policy set).
    if (agent.policy?.allowCreditDraw) {
      const buffer = agent.policy?.maxPerCall ?? total.toDecimalString();
      await maybeRepayTrustLineCredit(secretEnc, buffer);
    }
    // Pull the settlement tx hash out of the gateway's receipt header, for an
    // on-chain proof link. Best-effort — no link if it can't be decoded.
    let txHash: string | undefined;
    const receiptHeader = res.headers.get("x-payment-response");
    if (receiptHeader) {
      try {
        txHash = (
          JSON.parse(Buffer.from(receiptHeader, "base64").toString("utf8")) as { txHash?: string }
        ).txHash;
      } catch {
        // ignore
      }
    }
    return { ok: true, status: res.status, body, paid: total.toDecimalString(), borrowed, txHash };
  } catch {
    return { ok: false, error: "Couldn't reach the capability. Try again." };
  }
}

/** Map a gateway/upstream status to a message a human can act on. */
function friendlyError(status: number): string {
  if (status === 402) return "The payment was rejected. Check the agent's balance and trustline.";
  if (status === 429) return "The API is rate-limiting requests right now. Try again in a moment.";
  if (status === 404) return "This capability is no longer available.";
  if (status >= 500) return "The agent couldn't pay, or the upstream API is down. Try again.";
  return `The call failed (${status}).`;
}

/** The validated Pay intent an action capability returns to be signed. */
interface PayIntent {
  to: string;
  amount: string;
  memo?: string;
}

/** Parse a capability response into a Pay intent, or null if it isn't an action. */
function parsePayIntent(body: string): PayIntent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (p.tael_action !== "pay") return null;
  if (typeof p.to !== "string" || typeof p.amount !== "string") return null;
  return { to: p.to, amount: p.amount, memo: typeof p.memo === "string" ? p.memo : undefined };
}

/**
 * Execute a Pay action: enforce the spending policy, build ONE USDC transaction
 * (the payment + Tael's fee), sign it with the agent's card, and submit it. The
 * action and the fee settle atomically — the fee is another leg in the same tx.
 */
async function runPayAction(
  intent: PayIntent,
  address: string,
  policy: { maxPerCall: string; dailyLimit: string } | null,
  secretEnc: string,
): Promise<RunResult> {
  const amount = Money.parse(intent.amount);
  const feeStr = actionFee(intent.amount);
  const chargeFee = Number(feeStr) > 0;
  const fee = Money.parse(feeStr);
  const total = amount.add(fee);

  // Enforce the spending policy BEFORE signing — same gates as a paid call.
  if (policy) {
    if (total.isGreaterThan(Money.parse(policy.maxPerCall))) {
      return {
        ok: false,
        error: `Over the per-call cap ($${total.toDecimalString()} > $${policy.maxPerCall}).`,
      };
    }
    const projected = (await spentLast24h(address)).add(total);
    if (projected.isGreaterThan(Money.parse(policy.dailyLimit))) {
      return { ok: false, error: `Would exceed the daily limit of $${policy.dailyLimit}.` };
    }
  }

  // Must actually hold enough USDC to cover the payment + fee.
  const { usdc } = await fetchUsdcBalance(address);
  if (total.isGreaterThan(Money.parse(usdc))) {
    return {
      ok: false,
      error: `Not enough USDC. This card has $${usdc}, the payment needs $${total.toDecimalString()}. Fund it first.`,
    };
  }

  try {
    const legs = [{ to: intent.to, amount: intent.amount }];
    if (chargeFee) legs.push({ to: FEE_ADDRESS, amount: feeStr });
    const xdr = await buildSignedPayment({
      secret: decryptSecret(secretEnc),
      network: STELLAR_NETWORK,
      horizonUrl: HORIZON_URL,
      usdcIssuer: USDC_ISSUER,
      legs,
      memo: TAEL_MEMO,
    });
    const receipt = await createStellarSettlement({
      network: STELLAR_NETWORK,
      horizonUrl: HORIZON_URL,
      usdcIssuer: USDC_ISSUER,
    }).submitSignedTransaction(xdr);
    const result = {
      action: "pay",
      to: intent.to,
      amount: intent.amount,
      fee: feeStr,
      asset: "USDC",
      txHash: receipt.txHash,
    };
    return {
      ok: true,
      status: 200,
      body: JSON.stringify(result),
      paid: total.toDecimalString(),
      txHash: receipt.txHash,
    };
  } catch (error) {
    console.error("[run] pay action failed:", error);
    return {
      ok: false,
      error:
        "The payment couldn't be submitted. Check the card is funded and the destination trusts USDC.",
    };
  }
}

/** The validated Swap intent an action capability returns to be signed. */
interface SwapIntent {
  from: string;
  to: string;
  send: SwapAsset;
  sendAmount: string;
  dest: SwapAsset;
  destMin: string;
  estDest: string;
  path: SwapAsset[];
}

function isSwapAsset(v: unknown): v is SwapAsset {
  return (
    Boolean(v) &&
    typeof v === "object" &&
    typeof (v as Record<string, unknown>).asset_type === "string"
  );
}

/** Parse a capability response into a Swap intent, or null if it isn't one. */
function parseSwapIntent(body: string): SwapIntent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (p.tael_action !== "swap") return null;
  if (
    typeof p.from !== "string" ||
    typeof p.to !== "string" ||
    typeof p.sendAmount !== "string" ||
    typeof p.destMin !== "string" ||
    !isSwapAsset(p.send) ||
    !isSwapAsset(p.dest) ||
    !Array.isArray(p.path) ||
    !p.path.every(isSwapAsset)
  ) {
    return null;
  }
  return {
    from: p.from,
    to: p.to,
    send: p.send,
    sendAmount: p.sendAmount,
    dest: p.dest,
    destMin: p.destMin,
    estDest: typeof p.estDest === "string" ? p.estDest : p.destMin,
    path: p.path,
  };
}

/** Is this asset the USDC Tael settles in? */
function isUsdcAsset(a: SwapAsset): boolean {
  return a.asset_type !== "native" && a.asset_code === "USDC";
}

/**
 * Execute a Swap action: enforce the spending policy, build ONE transaction (a
 * strict-send path payment that converts send→dest on the agent's own card, plus
 * Tael's USDC fee), sign it with the card, and submit. The swap and the fee settle
 * atomically. `destMin` (the slippage floor set at quote time) guarantees the card
 * never accepts a worse fill than it was shown; if the market moved past it the
 * whole transaction fails and nothing trades.
 */
async function runSwapAction(
  intent: SwapIntent,
  address: string,
  policy: { maxPerCall: string; dailyLimit: string } | null,
  secretEnc: string,
): Promise<RunResult> {
  // Value the trade in USDC for the caps + the fee: whichever side is USDC. Selling
  // USDC uses the exact amount spent; buying USDC uses the guaranteed minimum
  // received. (v1 always has a USDC side, so one of these holds.)
  const usdValue = isUsdcAsset(intent.send)
    ? Money.parse(intent.sendAmount)
    : Money.parse(intent.destMin);
  // Tael's fee is a percentage of the trade's USDC value (same model as Pay).
  const feeStr = actionFee(usdValue.toDecimalString());
  const chargeFee = Number(feeStr) > 0;
  const fee = Money.parse(feeStr);
  const capTotal = usdValue.add(fee);
  // What actually leaves the card as USDC (for the receipt's "paid"): the sold USDC
  // if selling USDC, plus the fee. A buy (XLM→USDC) only spends the fee in USDC.
  const usdcOut = (
    isUsdcAsset(intent.send) ? Money.parse(intent.sendAmount) : Money.parse("0")
  ).add(fee);

  // Enforce the spending policy BEFORE signing — same gates as a paid call.
  if (policy) {
    if (capTotal.isGreaterThan(Money.parse(policy.maxPerCall))) {
      return {
        ok: false,
        error: `Over the per-call cap ($${capTotal.toDecimalString()} > $${policy.maxPerCall}).`,
      };
    }
    const projected = (await spentLast24h(address)).add(capTotal);
    if (projected.isGreaterThan(Money.parse(policy.dailyLimit))) {
      return { ok: false, error: `Would exceed the daily limit of $${policy.dailyLimit}.` };
    }
  }

  // The card must hold enough of the SEND asset, and — after the swap — enough USDC
  // to cover Tael's fee (which settles as the second op, so a swap INTO USDC can
  // fund its own fee from what it just received).
  const bal = await fetchAccountBalances(address);
  if (!bal.funded) return { ok: false, error: "This card isn't funded yet." };

  if (isUsdcAsset(intent.send)) {
    const need = Money.parse(intent.sendAmount).add(fee);
    if (need.isGreaterThan(Money.parse(bal.usdc))) {
      return {
        ok: false,
        error: `Not enough USDC. This card has $${bal.usdc}, the swap needs $${need.toDecimalString()}. Fund it first.`,
      };
    }
  } else {
    // Selling XLM: leave the account's base reserve intact ((2 + subentries) × 0.5
    // XLM) plus a small buffer for the network fee, so the swap can't strand the
    // account below its minimum.
    const reserve = (2 + bal.subentryCount) * 0.5 + 0.5;
    const spendableXlm = Number(bal.xlm) - reserve;
    if (Number(intent.sendAmount) > spendableXlm) {
      return {
        ok: false,
        error: `Not enough spendable XLM. This card has ${bal.xlm} XLM (~${Math.max(0, spendableXlm).toFixed(2)} after reserves), the swap sells ${intent.sendAmount}.`,
      };
    }
    // The fee is paid in USDC, from what the swap yields (or an existing balance).
    const projectedUsdc = Money.parse(bal.usdc).add(
      isUsdcAsset(intent.dest) ? Money.parse(intent.destMin) : Money.parse("0"),
    );
    if (fee.isGreaterThan(projectedUsdc)) {
      return {
        ok: false,
        error: `The card needs $${feeStr} USDC for the Tael fee. Add a little USDC first.`,
      };
    }
  }

  try {
    const xdr = await buildSignedSwap({
      secret: decryptSecret(secretEnc),
      network: STELLAR_NETWORK,
      horizonUrl: HORIZON_URL,
      send: intent.send,
      sendAmount: intent.sendAmount,
      dest: intent.dest,
      destMin: intent.destMin,
      path: intent.path,
      ...(chargeFee ? { fee: { to: FEE_ADDRESS, amount: feeStr, usdcIssuer: USDC_ISSUER } } : {}),
      memo: TAEL_MEMO,
    });
    const receipt = await createStellarSettlement({
      network: STELLAR_NETWORK,
      horizonUrl: HORIZON_URL,
      usdcIssuer: USDC_ISSUER,
    }).submitSignedTransaction(xdr);
    const result = {
      action: "swap",
      from: intent.from,
      to: intent.to,
      sold: intent.sendAmount,
      minReceived: intent.destMin,
      estReceived: intent.estDest,
      fee: feeStr,
      txHash: receipt.txHash,
    };
    return {
      ok: true,
      status: 200,
      body: JSON.stringify(result),
      paid: usdcOut.toDecimalString(),
      txHash: receipt.txHash,
    };
  } catch (error) {
    console.error("[run] swap action failed:", error);
    return {
      ok: false,
      error:
        "The swap couldn't be submitted. The market may have moved past your slippage limit — try again.",
    };
  }
}
