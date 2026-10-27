import { ethers } from "ethers";
import { getConfig } from "./config";

export const BEARER_ABI = [
  "function owner() view returns (address)",
  "function getBearer(string account) view returns (string)",
  "function setBearer(string account, string bearer)",
  "function setBearerBatch(string[] accounts, string[] bearerTokens)",
  "function transferOwnership(address newOwner)",
  "event BearerSet(string indexed accountKey, string account, address indexed by)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
];

export const MEMBER_ABI = [
  "function owner() view returns (address)",
  "function nextIndex() view returns (uint256)",
  "function remaining() view returns (uint256)",
  "function total() view returns (uint256)",
  "function isUsed(uint256 index) view returns (bool)",
  "function isCardUsed(uint256 index) view returns (bool)",
  "function addCards(string[] newCards)",
  "function getNextCard() returns (string)",
  "function skipCard(uint256 index)",
  "function transferOwnership(address newOwner)",
  "function renounceOwnership()",
  "event CardsAdded(uint256 startIndex, uint256 count)",
  "event CardTaken(uint256 indexed index, string card)",
];

export function getProvider(): ethers.JsonRpcProvider {
  const { rpcUrl } = getConfig();
  if (!rpcUrl) throw new Error("未配置 SEPOLIA_RPC_URL");
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getWallet(): ethers.Wallet {
  const { privateKey } = getConfig();
  if (!privateKey) throw new Error("未配置 ADMIN_PRIVATE_KEY");
  return new ethers.Wallet(privateKey, getProvider());
}

export function getBearerContract(withWallet = false) {
  const { bearerRegistry } = getConfig();
  const runner = withWallet ? getWallet() : getProvider();
  return new ethers.Contract(bearerRegistry, BEARER_ABI, runner);
}

export function getMemberContract(address: string, withWallet = false) {
  const runner = withWallet ? getWallet() : getProvider();
  return new ethers.Contract(address, MEMBER_ABI, runner);
}

export async function waitAndHash(
  tx: ethers.ContractTransactionResponse
): Promise<{ hash: string; receipt: ethers.TransactionReceipt }> {
  const receipt = await tx.wait();
  if (!receipt) throw new Error("交易回执为空");
  return { hash: tx.hash, receipt };
}

/** Parse CardTaken event from receipt (same approach as faka lib/contract.ts). */
export function parseCardTaken(
  contract: ethers.Contract,
  receipt: ethers.TransactionReceipt
): { index: number; card: string } | null {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
      if (parsed && parsed.name === "CardTaken") {
        return {
          index: Number(parsed.args.index),
          card: String(parsed.args.card),
        };
      }
    } catch {
      // ignore unrelated logs
    }
  }
  return null;
}

export async function readBearerStatus() {
  const cfg = getConfig();
  const c = getBearerContract(false);
  const wallet = cfg.privateKey
    ? new ethers.Wallet(cfg.privateKey)
    : null;
  const owner: string = await c.owner();
  return {
    address: cfg.bearerRegistry,
    owner,
    wallet: wallet?.address ?? null,
    isOwner: wallet ? owner.toLowerCase() === wallet.address.toLowerCase() : false,
  };
}

export async function readMemberStatus(address: string) {
  const cfg = getConfig();
  const c = getMemberContract(address, false);
  const wallet = cfg.privateKey
    ? new ethers.Wallet(cfg.privateKey)
    : null;
  const [owner, nextIndex, remaining, total] = await Promise.all([
    c.owner() as Promise<string>,
    c.nextIndex() as Promise<bigint>,
    c.remaining() as Promise<bigint>,
    c.total() as Promise<bigint>,
  ]);
  return {
    address,
    owner,
    nextIndex: Number(nextIndex),
    remaining: Number(remaining),
    total: Number(total),
    wallet: wallet?.address ?? null,
    isOwner: wallet ? owner.toLowerCase() === wallet.address.toLowerCase() : false,
  };
}
