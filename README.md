# NobodySMS 合约管理后台（Sepolia）

简易 Next.js（App Router）管理站，用于操作已部署的 Sepolia 合约：

| 合约 | 地址 |
|------|------|
| VeetoBearerRegistry（API账号 → Bearer） | `0x668abf17783ADb0F26cdD9049736C6954a6378CF` |
| MemberCardQueue · 3元 | `0xFd2d0EaEe67C0393f5218b8045824072f3727bAd` |
| MemberCardQueue · 15元 | `0xB482054498Fd24B8D55eB6A9AA26fA4fb18eAE85` |
| MemberCardQueue · 30元 | `0x9c06E39BE91e348dbCAc3A9338fC7c1E002A54A3` |

私钥与 RPC **只放在本地配置文件**，由服务端 API Route 使用，不会打进前端 JS。

---

## 快速开始

```bash
cp .env.example .env.local
# 编辑 .env.local：填入 SEPOLIA_RPC_URL 与 ADMIN_PRIVATE_KEY
npm install
npm run dev
```

浏览器打开 <http://localhost:3000>。

### 配置项（`.env.local`）

| 变量 | 说明 |
|------|------|
| `SEPOLIA_RPC_URL` | Sepolia JSON-RPC（Alchemy / Infura 等） |
| `ADMIN_PRIVATE_KEY` | 合约 Owner 私钥，需 `0x` 前缀 |
| `ADMIN_PASSWORD` | 可选。设置后 UI/API 需密码；**留空则完全开放，勿对公网暴露** |
| `VEETO_BEARER_REGISTRY` | Bearer 合约地址（示例已填） |
| `MEMBER_CARD_3` / `_15` / `_30` | 三档卡密合约地址（示例已填） |

也可把同名键放到 `config/local.env`，或使用根目录 `config.json`（字段名相同亦可）。**优先使用 `.env.local`。**

> `.env.local`、`config/local.env`、`config.json` 已在 `.gitignore` 中，切勿提交真实私钥 / RPC Key。

---

## 页面功能

四个 Tab：**Bearer 管理 | 3元卡密 | 15元卡密 | 30元卡密**。

### A) Bearer 管理（VeetoBearerRegistry）

| 操作 | 说明 |
|------|------|
| 刷新状态 | 显示 `owner()`、合约地址、当前钱包是否 Owner |
| 查询 Bearer | `getBearer(account)` |
| 设置 Bearer | `setBearer(account, bearer)` |
| 批量设置 | `setBearerBatch`；文本框每行 `account----bearer`（也支持 Tab / 逗号） |
| 转移所有权 | `transferOwnership(newOwner)` |

### B) 卡密队列（MemberCardQueue ×3）

| 操作 | 说明 |
|------|------|
| 状态栏 | `owner()` / `remaining()` / `total()` / `nextIndex()` |
| 批量上货 | `addCards(string[])`；文本框每行一张卡密 |
| 取出下一张 | `getNextCard()`；从 `CardTaken` 事件解析并显示卡密字符串 |
| 跳过索引 | `skipCard(index)`（不自动推进 `nextIndex`，慎用） |
| 查询是否已用 | `isCardUsed(index)` / `isUsed(index)` |
| 快捷视图 | `owner` / `nextIndex` / `remaining` / `total` |
| 转移 / 放弃所有权 | `transferOwnership` / `renounceOwnership` |

写操作成功后会返回交易 hash，并可跳转 [Sepolia Etherscan](https://sepolia.etherscan.io)。

---

## API 一览（均服务端执行）

- `GET /api/auth` · `POST /api/auth`（登录写 cookie）· `DELETE /api/auth`
- `GET /api/status` — 四个合约实时状态
- `GET|POST /api/bearer` — Bearer 读/写
- `GET|POST /api/cards?tier=3|15|30` — 卡密读/写

若配置了 `ADMIN_PASSWORD`，请求需带登录 cookie，或 Header：`x-admin-password` / `Authorization: Bearer <密码>`。

---

## 安全提示

1. 私钥仅出现在服务端环境变量；不要写进前端代码或提交到 Git。
2. 未设置 `ADMIN_PASSWORD` 时，任何能访问该站点的人都能触发链上写操作。
3. `renounceOwnership` / `transferOwnership` / `getNextCard` / `skipCard` 均为不可逆或消耗性操作，请先在测试网确认。
4. 生产部署请使用 HTTPS，并务必设置 `ADMIN_PASSWORD`。

---

## 技术栈

- Next.js 15（App Router）+ React 19 + TypeScript
- ethers v6（服务端 wallet + 合约调用）
