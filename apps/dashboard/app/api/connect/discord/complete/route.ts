import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "../../../../../features/capabilities/current-user";
import { upsertDiscordChannelLink } from "../../../../../features/products/channel-links";
import { verifyDiscordConnectToken } from "../../../../../lib/connect-token";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1),
  agentId: z.string().uuid(),
});

/** Complete Discord wallet connect: bind discord user → signed-in user + Card. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const raw = (await request.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let connect;
  try {
    connect = await verifyDiscordConnectToken(parsed.data.token);
  } catch {
    return NextResponse.json(
      { error: "This connect link expired. Run /connect in Discord again." },
      { status: 400 },
    );
  }

  const result = await upsertDiscordChannelLink({
    productId: connect.productId,
    discordUserId: connect.externalUserId,
    userId: user.id,
    agentId: parsed.data.agentId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    productName: connect.productName,
    walletAddress: user.walletAddress,
  });
}
