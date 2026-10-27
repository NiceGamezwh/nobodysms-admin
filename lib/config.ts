import fs from "fs";
import path from "path";

export type CardTier = "3" | "15" | "30" | "r15" | "r30" | "r60";

export const CARD_TIERS: CardTier[] = ["3", "15", "30", "r15", "r30", "r60"];
export const REGISTER_CARD_TIERS: CardTier[] = ["3", "15", "30"];
export const RECHARGE_CARD_TIERS: CardTier[] = ["r15", "r30", "r60"];

export type AppConfig = {
  rpcUrl: string;
  privateKey: string;
  adminPassword: string | null;
  bearerRegistry: string;
  cards: Record<CardTier, string>;
};

function loadOptionalEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

function loadOptionalJson(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      string
    >;
    const map: Record<string, string> = {
      SEPOLIA_RPC_URL: data.SEPOLIA_RPC_URL || data.rpcUrl || "",
      ADMIN_PRIVATE_KEY:
        data.ADMIN_PRIVATE_KEY ||
        data.DEPLOYER_PRIVATE_KEY ||
        data.privateKey ||
        "",
      ADMIN_PASSWORD: data.ADMIN_PASSWORD || data.adminPassword || "",
      VEETO_BEARER_REGISTRY:
        data.VEETO_BEARER_REGISTRY || data.bearerRegistry || "",
      MEMBER_CARD_3: data.MEMBER_CARD_3 || data.card3 || "",
      MEMBER_CARD_15: data.MEMBER_CARD_15 || data.card15 || "",
      MEMBER_CARD_30: data.MEMBER_CARD_30 || data.card30 || "",
      MEMBER_CARD_R15:
        data.MEMBER_CARD_R15 || data.RECHARGE_CARD_15 || data.cardR15 || "",
      MEMBER_CARD_R30:
        data.MEMBER_CARD_R30 || data.RECHARGE_CARD_30 || data.cardR30 || "",
      MEMBER_CARD_R60:
        data.MEMBER_CARD_R60 || data.RECHARGE_CARD_60 || data.cardR60 || "",
    };
    for (const [k, v] of Object.entries(map)) {
      if (v && (!(k in process.env) || process.env[k] === "")) {
        process.env[k] = v;
      }
    }
  } catch {
    // ignore malformed optional config
  }
}

/** Load .env.local / config/local.env / config.json once (server-side). */
export function ensureConfigLoaded() {
  const root = process.cwd();
  // Prefer Next's own .env.local (already loaded by Next). Also support fallbacks.
  loadOptionalEnvFile(path.join(root, "config", "local.env"));
  loadOptionalJson(path.join(root, "config.json"));
}

export function getConfig(): AppConfig {
  ensureConfigLoaded();

  const rpcUrl = (process.env.SEPOLIA_RPC_URL || "").trim();
  let privateKey = (process.env.ADMIN_PRIVATE_KEY || "").trim();
  if (privateKey && !privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim() || null;

  const bearerRegistry = (
    process.env.VEETO_BEARER_REGISTRY ||
    "0x668abf17783ADb0F26cdD9049736C6954a6378CF"
  ).trim();
  const card3 = (
    process.env.MEMBER_CARD_3 ||
    "0xE482CC61DF0dBca6AB3A694a8813Bacf13A04976"
  ).trim();
  const card15 = (
    process.env.MEMBER_CARD_15 ||
    "0x4F3C14b4cFC5D3a27B00FF737Eab28D948517c9e"
  ).trim();
  const card30 = (
    process.env.MEMBER_CARD_30 ||
    "0xFC76E223573BC92F24a2A956cd6f771D1059de6d"
  ).trim();
  const cardR15 = (
    process.env.MEMBER_CARD_R15 ||
    process.env.RECHARGE_CARD_15 ||
    "0x4668114059aF15AC701045AD311DFa974370Ef0e"
  ).trim();
  const cardR30 = (
    process.env.MEMBER_CARD_R30 ||
    process.env.RECHARGE_CARD_30 ||
    "0x0785Bf86A9B9869940F4F605c58386a4BFD0E1CB"
  ).trim();
  const cardR60 = (
    process.env.MEMBER_CARD_R60 ||
    process.env.RECHARGE_CARD_60 ||
    "0x9aCDfa778ED64AB2D1297FB735862ebdEC97Bc12"
  ).trim();

  return {
    rpcUrl,
    privateKey,
    adminPassword,
    bearerRegistry,
    cards: {
      "3": card3,
      "15": card15,
      "30": card30,
      r15: cardR15,
      r30: cardR30,
      r60: cardR60,
    },
  };
}

export function getCardAddress(
  tier: string,
  cfg?: AppConfig
): string | null {
  const c = cfg || getConfig();
  if (
    tier === "3" ||
    tier === "15" ||
    tier === "30" ||
    tier === "r15" ||
    tier === "r30" ||
    tier === "r60"
  ) {
    return c.cards[tier];
  }
  return null;
}

export const EXPLORER_TX = "https://sepolia.etherscan.io/tx/";
export const EXPLORER_ADDR = "https://sepolia.etherscan.io/address/";
