import { NextRequest, NextResponse } from "next/server";
import { requestAuthorized } from "@/lib/auth";
import { EXPLORER_TX } from "@/lib/config";
import {
  getBearerContract,
  waitAndHash,
} from "@/lib/contracts";

export const runtime = "nodejs";

type Body = {
  action?: string;
  account?: string;
  bearer?: string;
  lines?: string;
  newOwner?: string;
};

function parseBatch(lines: string): { accounts: string[]; bearers: string[] } {
  const accounts: string[] = [];
  const bearers: string[] = [];
  for (const raw of lines.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // account----bearer / account---bearer / tab / comma（只按首个分隔符切，Bearer 里可含 -）
    let account = "";
    let bearer = "";
    if (line.includes("----")) {
      const i = line.indexOf("----");
      account = line.slice(0, i).trim();
      bearer = line.slice(i + 4).trim();
    } else if (line.includes("---")) {
      const i = line.indexOf("---");
      account = line.slice(0, i).trim();
      bearer = line.slice(i + 3).trim();
    } else if (line.includes("\t")) {
      const parts = line.split("\t");
      account = (parts[0] || "").trim();
      bearer = parts.slice(1).join("\t").trim();
    } else if (line.includes(",")) {
      const i = line.indexOf(",");
      account = line.slice(0, i).trim();
      bearer = line.slice(i + 1).trim();
    } else {
      throw new Error(`无法解析行（需 account---bearer 或 account----bearer）：${line.slice(0, 40)}`);
    }
    if (!account) throw new Error("空 account");
    accounts.push(account);
    bearers.push(bearer);
  }
  if (!accounts.length) throw new Error("没有有效行");
  return { accounts, bearers };
}

export async function GET(req: NextRequest) {
  if (!requestAuthorized(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const account = req.nextUrl.searchParams.get("account") || "";
  if (!account) {
    return NextResponse.json({ error: "缺少 account" }, { status: 400 });
  }
  try {
    const c = getBearerContract(false);
    const bearer: string = await c.getBearer(account);
    const owner: string = await c.owner();
    return NextResponse.json({ account, bearer, owner });
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

  try {
    const c = getBearerContract(true);

    if (action === "getBearer") {
      const account = (body.account || "").trim();
      if (!account) return NextResponse.json({ error: "缺少 account" }, { status: 400 });
      const bearer: string = await c.getBearer(account);
      return NextResponse.json({ account, bearer });
    }

    if (action === "setBearer") {
      const account = (body.account || "").trim();
      const bearer = body.bearer ?? "";
      if (!account) return NextResponse.json({ error: "缺少 account" }, { status: 400 });
      const tx = await c.setBearer(account, bearer);
      const { hash } = await waitAndHash(tx);
      return NextResponse.json({
        ok: true,
        action,
        hash,
        explorer: EXPLORER_TX + hash,
      });
    }

    if (action === "setBearerBatch") {
      const { accounts, bearers } = parseBatch(body.lines || "");
      const tx = await c.setBearerBatch(accounts, bearers);
      const { hash } = await waitAndHash(tx);
      return NextResponse.json({
        ok: true,
        action,
        count: accounts.length,
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
        hash,
        explorer: EXPLORER_TX + hash,
      });
    }

    if (action === "owner") {
      const owner: string = await c.owner();
      return NextResponse.json({ owner });
    }

    return NextResponse.json({ error: `未知 action: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
