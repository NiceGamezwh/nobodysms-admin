import { NextRequest, NextResponse } from "next/server";
import { requestAuthorized } from "@/lib/auth";
import { getConfig, getCardAddress } from "@/lib/config";
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
    const [bearer, card3, card15, card30] = await Promise.all([
      readBearerStatus(),
      readMemberStatus(getCardAddress("3", cfg)!),
      readMemberStatus(getCardAddress("15", cfg)!),
      readMemberStatus(getCardAddress("30", cfg)!),
    ]);
    return NextResponse.json({
      network: "sepolia",
      chainId: 11155111,
      hasPrivateKey: !!cfg.privateKey,
      authRequired: !!cfg.adminPassword,
      bearer,
      cards: { "3": card3, "15": card15, "30": card30 },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
