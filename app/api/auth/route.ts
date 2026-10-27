import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  checkPassword,
  isAuthEnabled,
  makeAuthCookieValue,
} from "@/lib/auth";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    authRequired: isAuthEnabled(),
    configured: !!(getConfig().rpcUrl && getConfig().privateKey),
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true, authRequired: false });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = body.password || "";
  if (!checkPassword(password)) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, makeAuthCookieValue(password), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
