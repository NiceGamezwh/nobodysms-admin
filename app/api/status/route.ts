import { NextRequest, NextResponse } from "next/server";
import { requestAuthorized } from "@/lib/auth";
import { CARD_TIERS, getConfig, getCardAddress } from "@/lib/config";
import { readBearerStatus, readMemberStatus } from "@/lib/contracts";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!requestAuthorized(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const cfg = getConfig();
  if (!cfg.rpcUrl) {
    return NextResponse.json(
      { error: "未配置 SEPOLIA_RPC_URL，请复制 .env.example → .env.local" },
      { status: 500 }
    );
  }

  try {
    const [bearer, ...cardStatuses] = await Promise.all([
      readBearerStatus(),
      ...CARD_TIERS.map((tier) => readMemberStatus(getCardAddress(tier, cfg)!)),
    ]);
    const cards: Record<string, (typeof cardStatuses)[number]> = {};
    CARD_TIERS.forEach((tier, i) => {
      cards[tier] = cardStatuses[i];
    });
    return NextResponse.json({
      network: "sepolia",
      chainId: 11155111,
      hasPrivateKey: !!cfg.privateKey,
      authRequired: !!cfg.adminPassword,
      bearer,
      cards,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
