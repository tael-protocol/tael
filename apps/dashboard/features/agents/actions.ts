"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { agents, and, decryptSecret, encryptSecret, eq, wallets } from "@tael/database";
import { generateKeypair, provisionHotWallet } from "@tael/stellar";
import { db } from "../../lib/db";
import { getCurrentUser } from "../capabilities/current-user";

const STELLAR_NETWORK = process.env.STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
const HORIZON_URL = process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const USDC_ISSUER = process.env.USDC_ISSUER ?? "";

const nameSchema = z.string().trim().min(1, "Name is required").max(60);
const amountSchema = z.string().regex(/^\d+(\.\d+)?$/, "Enter an amount, e.g. 0.10");

/**
 * Resolve `p`, but give up after `ms` and resolve `onTimeout` instead. Wallet
 * provisioning does network I/O (friendbot fund + trustline) that can outlast a
 * serverless function's budget — if the whole action ran that long the transport
 * call would reject on the client even though the agent row was already written.
 * Capping the wait keeps createAgent snappy; provisioning stays retryable.
 */
function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(onTimeout), ms))]);
}

const createAgentSchema = z.object({
  name: nameSchema,
  maxPerCall: amountSchema,
  dailyLimit: amountSchema,
});

export interface CreateAgentResult {
  ok: boolean;
  /** New agent/Card id. */
  id?: string;
  /** The new hot wallet's public address to fund. */
  address?: string;
  /** True once the wallet is provisioned (funded + USDC trustline) and can receive USDC. */
  ready?: boolean;
  /** Set when the agent was created but provisioning didn't complete (retryable). */
  provisionError?: string;
  error?: string;
}

/**
 * Create an agent with a fresh hot wallet: generate a Stellar keypair, encrypt
 * the secret at rest, and store the wallet + agent (with its spending policy).
 * Returns only the PUBLIC address — the secret never leaves the server.
 */
export async function createAgent(input: {
  name: string;
  maxPerCall: string;
  dailyLimit: string;
}): Promise<CreateAgentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = createAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { name, maxPerCall, dailyLimit } = parsed.data;

  const keypair = generateKeypair();
  let agentId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [wallet] = await tx
        .insert(wallets)
        .values({
          ownerId: user.id,
          address: keypair.publicKey,
          label: name,
          secretEnc: encryptSecret(keypair.secret),
        })
        .returning({ id: wallets.id });

      const [agent] = await tx
        .insert(agents)
        .values({
          ownerId: user.id,
          name,
          walletId: wallet!.id,
          policy: { maxPerCall, dailyLimit, blockedPublishers: [] },
        })
        .returning({ id: agents.id });
      agentId = agent?.id;
    });
  } catch (error) {
    console.error("[agents] create failed:", error);
    return { ok: false, error: "Could not create the agent. Try again." };
  }

  // Provision the wallet so it can actually receive USDC (fund XLM + add the
  // trustline). If this fails, the agent still exists — it's retryable from the
  // card, so we surface the error rather than failing the whole create. Wrapped
  // defensively so a provisioning fault can never crash the create action.
  let provision: { ok: boolean; ready: boolean; error?: string };
  try {
    provision = await withTimeout(
      provisionHotWallet({
        secret: keypair.secret,
        network: STELLAR_NETWORK,
        horizonUrl: HORIZON_URL,
        usdcIssuer: USDC_ISSUER,
      }),
      12_000,
      { ok: false, ready: false, error: "Still provisioning — retry from the card in a moment." },
    );
  } catch (error) {
    console.error("[agents] provision threw:", error);
    provision = { ok: false, ready: false, error: "Provisioning failed. Retry from the agent." };
  }

  revalidatePath("/agents");
  return {
    ok: true,
    id: agentId,
    address: keypair.publicKey,
    ready: provision.ready,
    provisionError: provision.ok ? undefined : provision.error,
  };
}

/**
 * Retry provisioning an existing agent's hot wallet (fund + trustline). Used by
 * the "Provision wallet" action on an unprovisioned card. Ownership-checked.
 */
export async function provisionAgent(agentId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const [row] = await db
    .select({ secretEnc: wallets.secretEnc })
    .from(agents)
    .innerJoin(wallets, eq(agents.walletId, wallets.id))
    .where(and(eq(agents.id, agentId), eq(agents.ownerId, user.id)))
    .limit(1);

  if (!row?.secretEnc) return { ok: false, error: "Wallet not found." };

  const result = await provisionHotWallet({
    secret: decryptSecret(row.secretEnc),
    network: STELLAR_NETWORK,
    horizonUrl: HORIZON_URL,
    usdcIssuer: USDC_ISSUER,
  });

  revalidatePath("/agents");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

const updateAgentSchema = z.object({
  name: nameSchema,
  maxPerCall: amountSchema,
  dailyLimit: amountSchema,
  allowCreditDraw: z.boolean().optional(),
});

/** Update an agent's name and spending policy. Ownership-checked. */
export async function updateAgent(
  agentId: string,
  input: { name: string; maxPerCall: string; dailyLimit: string; allowCreditDraw?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = updateAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { name, maxPerCall, dailyLimit, allowCreditDraw } = parsed.data;

  try {
    await db
      .update(agents)
      .set({
        name,
        policy: { maxPerCall, dailyLimit, blockedPublishers: [], allowCreditDraw },
      })
      .where(and(eq(agents.id, agentId), eq(agents.ownerId, user.id)));
  } catch (error) {
    console.error("[agents] update failed:", error);
    return { ok: false, error: "Could not save. Try again." };
  }

  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
  return { ok: true };
}

/**
 * Delete an agent the signed-in user owns. The wallet row (and its encrypted
 * key) is left intact so any on-chain funds remain recoverable; only the agent
 * binding is removed.
 */
export async function deleteAgent(agentId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  try {
    await db.delete(agents).where(and(eq(agents.id, agentId), eq(agents.ownerId, user.id)));
  } catch (error) {
    console.error("[agents] delete failed:", error);
    return { ok: false, error: "Could not delete. Try again." };
  }

  revalidatePath("/agents");
  return { ok: true };
}
