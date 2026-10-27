import { NextRequest } from "next/server";
import { getConfig } from "./config";

const COOKIE = "nobodysms_admin_auth";

export function isAuthEnabled(): boolean {
  return !!getConfig().adminPassword;
}

export function checkPassword(password: string): boolean {
  const cfg = getConfig();
  if (!cfg.adminPassword) return true;
  return password === cfg.adminPassword;
}

export function makeAuthCookieValue(password: string): string {
  // Simple opaque token: base64(password). Enough for optional local gate.
  return Buffer.from(password, "utf8").toString("base64url");
}

export function requestAuthorized(req: NextRequest): boolean {
  const cfg = getConfig();
  if (!cfg.adminPassword) return true;

  const header = req.headers.get("x-admin-password");
  if (header && header === cfg.adminPassword) return true;

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7) === cfg.adminPassword) {
    return true;
  }

  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && cookie === makeAuthCookieValue(cfg.adminPassword)) {
    return true;
  }

  return false;
}

export { COOKIE as AUTH_COOKIE };
