import { NextRequest, NextResponse } from "next/server";
import { requestAuthorized } from "@/lib/auth";
import { EXPLORER_TX, getCardAddress, getConfig } from "@/lib/config";
import {
  getMemberContract,
  parseCardTaken,
  waitAndHash,
} from "@/lib/contracts";

export const runtime = "nodejs";

type Body = {
  action?: string;
  tier?: string;
  cardsText?: string;
  index?: number | string;
  newOwner?: string;
};

function parseCards(text: string): string[] {
  const cards: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    cards.push(line);
  }
  if (!cards.length) throw new Error("卡密列表为空（每行一张）");
  return cards;
}

export async function GET(req: NextRequest) {
  if (!requestAuthorized(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const tier = req.nextUrl.searchParams.get("tier") || "";
  const indexStr = req.nextUrl.searchParams.get("index");
  const addr = getCardAddress(tier);
  if (!addr) {
    return NextResponse.json({ error: "tier 必须是 3 / 15 / 30" }, { status: 400 });
  }
  try {
    const c = getMemberContract(addr, false);
    if (indexStr != null && indexStr !== "") {
      const index = Number(indexStr);
      if (!Number.isInteger(index) || index < 0) {
        return NextResponse.json({ error: "index 无效" }, { status: 400 });
      }
      let used: boolean;
      try {
        used = await c.isCardUsed(index);
      } catch {
        used = await c.isUsed(index);
      }
      return NextResponse.json({ tier, address: addr, index, used });
    }
    const [owner, nextIndex, remaining, total] = await Promise.all([
      c.owner(),
      c.nextIndex(),
      c.remaining(),
      c.total(),
    ]);
    return NextResponse.json({
      tier,
      address: addr,
      owner,
      nextIndex: Number(nextIndex),
      remaining: Number(remaining),
      total: Number(total),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!requestAuthorized(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  const action = body.action || "";
  const tier = String(body.tier || "");
  const addr = getCardAddress(tier, getConfig());
  if (!addr) {
    return NextResponse.json({ error: "tier 必须是 3 / 15 / 30" }, { status: 400 });
  }

  try {
    if (
      action === "owner" ||
      action === "nextIndex" ||
      action === "remaining" ||
      action === "total" ||
      action === "isCardUsed" ||
      action === "isUsed"
    ) {
      const c = getMemberContract(addr, false);
      if (action === "owner") {
        return NextResponse.json({ owner: await c.owner() });
      }
      if (action === "nextIndex") {
        return NextResponse.json({ nextIndex: Number(await c.nextIndex()) });
      }
      if (action === "remaining") {
        return NextResponse.json({ remaining: Number(await c.remaining()) });
      }
      if (action === "total") {
        return NextResponse.json({ total: Number(await c.total()) });
      }
      const index = Number(body.index);
      if (!Number.isInteger(index) || index < 0) {
        return NextResponse.json({ error: "index 无效" }, { status: 400 });
      }
      let used: boolean;
      try {
        used = await c.isCardUsed(index);
      } catch {
        used = await c.isUsed(index);
      }
      return NextResponse.json({ index, used });
    }

    const c = getMemberContract(addr, true);

    if (action === "addCards") {
      const cards = parseCards(body.cardsText || "");
      const tx = await c.addCards(cards);
      const { hash } = await waitAndHash(tx);
      return NextResponse.json({
        ok: true,
        action,
        tier,
        count: cards.length,
        hash,
        explorer: EXPLORER_TX + hash,
      });
    }

    if (action === "getNextCard") {
      const tx = await c.getNextCard();
      const { hash, receipt } = await waitAndHash(tx);
      const taken = parseCardTaken(c, receipt);
      if (!taken) {
        return NextResponse.json(
          {
            ok: true,
            action,
            tier,
            hash,
            explorer: EXPLORER_TX + hash,
            warning: "交易已上链但未解析到 CardTaken 事件",
          },
          { status: 200 }
        );
      }
      return NextResponse.json({
        ok: true,
        action,
        tier,
        index: taken.index,
        card: taken.card,
        hash,
        explorer: EXPLORER_TX + hash,
      });
    }

    if (action === "skipCard") {
      const index = Number(body.index);
      if (!Number.isInteger(index) || index < 0) {
        return NextResponse.json({ error: "index 无效" }, { status: 400 });
      }
      const tx = await c.skipCard(index);
      const { hash } = await waitAndHash(tx);
      return NextResponse.json({
        ok: true,
        action,
        tier,
        index,
        hash,
        explorer: EXPLORER_TX + hash,
      });
    }

    if (action === "transferOwnership") {
      const newOwner = (body.newOwner || "").trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(newOwner)) {
        return NextResponse.json({ error: "newOwner 地址无效" }, { status: 400 });
      }
      const tx = await c.transferOwnership(newOwner);
      const { hash } = await waitAndHash(tx);
      return NextResponse.json({
        ok: true,
        action,
        tier,
        hash,
        explorer: EXPLORER_TX + hash,
      });
    }

    if (action === "renounceOwnership") {
      const tx = await c.renounceOwnership();
      const { hash } = await waitAndHash(tx);
      return NextResponse.json({
        ok: true,
        action,
        tier,
        hash,
        explorer: EXPLORER_TX + hash,
      });
    }

    return NextResponse.json({ error: `未知 action: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
