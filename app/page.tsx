"use client";

import { useCallback, useEffect, useState } from "react";

type Tab = "bearer" | "3" | "15" | "30" | "r15" | "r30" | "r60";

type CardTab = Exclude<Tab, "bearer">;
const CARD_TABS: CardTab[] = ["3", "15", "30", "r15", "r30", "r60"];
const REGISTER_TABS: CardTab[] = ["3", "15", "30"];
const RECHARGE_TABS: CardTab[] = ["r15", "r30", "r60"];

function isCardTab(tab: Tab): tab is CardTab {
  return tab !== "bearer";
}

function cardTabLabel(tab: CardTab): string {
  switch (tab) {
    case "3":
      return "注册3元";
    case "15":
      return "注册15元";
    case "30":
      return "注册30元";
    case "r15":
      return "充值15元";
    case "r30":
      return "充值30元";
    case "r60":
      return "充值60元";
  }
}

function cardKindLabel(tab: CardTab): string {
  return RECHARGE_TABS.includes(tab) ? "充值卡密" : "注册卡密";
}

function cardAmountLabel(tab: CardTab): string {
  switch (tab) {
    case "3":
      return "3元";
    case "15":
    case "r15":
      return "15元";
    case "30":
    case "r30":
      return "30元";
    case "r60":
      return "60元";
  }
}

type MemberStatus = {
  address: string;
  owner: string;
  nextIndex: number;
  remaining: number;
  total: number;
  wallet: string | null;
  isOwner: boolean;
};

type StatusPayload = {
  network: string;
  chainId: number;
  hasPrivateKey: boolean;
  authRequired: boolean;
  bearer: {
    address: string;
    owner: string;
    wallet: string | null;
    isOwner: boolean;
  };
  cards: Record<"3" | "15" | "30" | "r15" | "r30" | "r60", MemberStatus>;
};

async function api<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

function ResultBox({
  result,
}: {
  result: { ok?: boolean; text: string } | null;
}) {
  if (!result) return null;
  return (
    <div className={`result ${result.ok === false ? "err" : "ok"}`}>
      {result.text}
    </div>
  );
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("bearer");
  const [authRequired, setAuthRequired] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; text: string } | null>(
    null
  );

  // Bearer form state
  const [account, setAccount] = useState("");
  const [bearer, setBearer] = useState("");
  const [batchLines, setBatchLines] = useState("");
  const [newOwnerBearer, setNewOwnerBearer] = useState("");

  // Card form state
  const [cardsText, setCardsText] = useState("");
  const [skipIndex, setSkipIndex] = useState("");
  const [checkIndex, setCheckIndex] = useState("");
  const [newOwnerCard, setNewOwnerCard] = useState("");

  const refreshAuthMeta = useCallback(async () => {
    const meta = await api<{ authRequired: boolean; configured: boolean }>(
      "/api/auth"
    );
    setAuthRequired(meta.authRequired);
    if (!meta.authRequired) setAuthed(true);
  }, []);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const data = await api<StatusPayload>("/api/status");
      setStatus(data);
      setAuthed(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("未授权") || msg.includes("401")) {
        setAuthed(false);
        setStatus(null);
      } else {
        setError(msg);
      }
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthMeta()
      .then(() => refreshStatus())
      .catch(() => {});
  }, [refreshAuthMeta, refreshStatus]);

  async function login() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setAuthed(true);
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function run(
    fn: () => Promise<unknown>,
    opts?: { refresh?: boolean }
  ) {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const data = await fn();
      setResult({ ok: true, text: formatJson(data) });
      if (opts?.refresh !== false) await refreshStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResult({ ok: false, text: msg });
    } finally {
      setBusy(false);
    }
  }

  if (authRequired && !authed) {
    return (
      <div className="container">
        <h1>NobodySMS 合约管理后台</h1>
        <p className="muted">已启用 ADMIN_PASSWORD，请先登录。</p>
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="field">
            <label>管理密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
          </div>
          <button disabled={busy} onClick={login}>
            登录
          </button>
          {error && <div className="result err">{error}</div>}
        </div>
      </div>
    );
  }

  const cardStatus = isCardTab(tab) ? status?.cards?.[tab] : null;
  const isRechargeTab = isCardTab(tab) && RECHARGE_TABS.includes(tab);

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 style={{ margin: "0 0 6px" }}>NobodySMS 合约管理后台</h1>
          <p className="muted" style={{ margin: 0 }}>
            Sepolia · 私钥与 RPC 仅来自服务端配置文件，不会下发到浏览器
          </p>
        </div>
        <div className="row">
          <button className="secondary" disabled={loadingStatus || busy} onClick={refreshStatus}>
            {loadingStatus ? "刷新中…" : "刷新状态"}
          </button>
        </div>
      </div>

      {error && <div className="result err">{error}</div>}

      {status && (
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="badge ok">{status.network}</span>
            <span className="muted">chainId {status.chainId}</span>
            <span className={`badge ${status.hasPrivateKey ? "ok" : "no"}`}>
              {status.hasPrivateKey ? "已配置私钥" : "未配置私钥"}
            </span>
            {status.bearer.wallet && (
              <span className="muted mono">钱包 {status.bearer.wallet}</span>
            )}
          </div>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${tab === "bearer" ? "active" : ""}`}
          onClick={() => {
            setTab("bearer");
            setResult(null);
          }}
        >
          Bearer 管理
        </button>
        {CARD_TABS.map((id) => (
          <button
            key={id}
            className={`tab ${tab === id ? "active" : ""}`}
            onClick={() => {
              setTab(id);
              setResult(null);
              setCardsText("");
            }}
          >
            {cardTabLabel(id)}
          </button>
        ))}
      </div>

      {tab === "bearer" && status && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">合约地址</div>
              <div className="v mono">
                <a
                  href={`https://sepolia.etherscan.io/address/${status.bearer.address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {status.bearer.address}
                </a>
              </div>
            </div>
            <div className="stat">
              <div className="k">owner()</div>
              <div className="v mono">{status.bearer.owner}</div>
            </div>
            <div className="stat">
              <div className="k">当前钱包是否 Owner</div>
              <div className="v">
                <span className={`badge ${status.bearer.isOwner ? "ok" : "no"}`}>
                  {status.bearer.isOwner ? "是" : "否"}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>查询 getBearer(account)</h3>
            <div className="field">
              <label>API 账号</label>
              <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="例如 a17263900020" />
            </div>
            <button
              disabled={busy || !account.trim()}
              onClick={() =>
                run(
                  () =>
                    api("/api/bearer", {
                      method: "POST",
                      body: JSON.stringify({ action: "getBearer", account }),
                    }),
                  { refresh: false }
                )
              }
            >
              查询 Bearer
            </button>
          </div>

          <div className="card">
            <h3>写入 setBearer(account, bearer)</h3>
            <div className="field">
              <label>API 账号</label>
              <input value={account} onChange={(e) => setAccount(e.target.value)} />
            </div>
            <div className="field">
              <label>Bearer Token</label>
              <input value={bearer} onChange={(e) => setBearer(e.target.value)} />
            </div>
            <button
              disabled={busy || !account.trim()}
              onClick={() =>
                run(() =>
                  api("/api/bearer", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "setBearer",
                      account,
                      bearer,
                    }),
                  })
                )
              }
            >
              设置 Bearer
            </button>
          </div>

          <div className="card">
            <h3>批量 setBearerBatch</h3>
            <p className="muted">每行一条：<code>account---bearer</code> 或 <code>account----bearer</code>（也支持 Tab / 逗号）</p>
            <div className="field">
              <textarea
                value={batchLines}
                onChange={(e) => setBatchLines(e.target.value)}
                placeholder={"acc1---bearer1\nacc2---bearer2"}
              />
            </div>
            <button
              disabled={busy || !batchLines.trim()}
              onClick={() =>
                run(() =>
                  api("/api/bearer", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "setBearerBatch",
                      lines: batchLines,
                    }),
                  })
                )
              }
            >
              批量设置
            </button>
          </div>

          <div className="card">
            <h3>transferOwnership(newOwner)</h3>
            <div className="field">
              <label>新 Owner 地址</label>
              <input
                value={newOwnerBearer}
                onChange={(e) => setNewOwnerBearer(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <button
              className="danger"
              disabled={busy || !newOwnerBearer.trim()}
              onClick={() => {
                if (!confirm("确认转移 Bearer 合约所有权？")) return;
                run(() =>
                  api("/api/bearer", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "transferOwnership",
                      newOwner: newOwnerBearer,
                    }),
                  })
                );
              }}
            >
              转移所有权
            </button>
          </div>
        </>
      )}

      {isCardTab(tab) && cardStatus && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="k">合约地址（{cardKindLabel(tab)} · {cardAmountLabel(tab)}）</div>
              <div className="v mono">
                <a
                  href={`https://sepolia.etherscan.io/address/${cardStatus.address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {cardStatus.address}
                </a>
              </div>
            </div>
            <div className="stat">
              <div className="k">owner()</div>
              <div className="v mono">{cardStatus.owner}</div>
            </div>
            <div className="stat">
              <div className="k">remaining() / total()</div>
              <div className="v">
                {cardStatus.remaining} / {cardStatus.total}
              </div>
            </div>
            <div className="stat">
              <div className="k">nextIndex()</div>
              <div className="v">{cardStatus.nextIndex}</div>
            </div>
            <div className="stat">
              <div className="k">当前钱包是否 Owner</div>
              <div className="v">
                <span className={`badge ${cardStatus.isOwner ? "ok" : "no"}`}>
                  {cardStatus.isOwner ? "是" : "否"}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>addCards(string[]) — 上新卡密</h3>
            <p className="muted">
              {isRechargeTab
                ? "每行一张充值单码（无 ---- 分隔符）"
                : "每行一张完整卡密字符串（账号----密码）"}
            </p>
            <div className="field">
              <textarea
                value={cardsText}
                onChange={(e) => setCardsText(e.target.value)}
                placeholder={
                  isRechargeTab
                    ? "Gc47ED2DF6D5473E3D0B974C748BF1BB95\n..."
                    : "账号----密码\n..."
                }
              />
            </div>
            <button
              disabled={busy || !cardsText.trim()}
              onClick={() =>
                run(() =>
                  api("/api/cards", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "addCards",
                      tier: tab,
                      cardsText,
                    }),
                  })
                )
              }
            >
              批量上货
            </button>
          </div>

          <div className="card">
            <h3>getNextCard() — 取出下一张</h3>
            <p className="muted">会消耗库存；结果从 CardTaken 事件解析并显示卡密。</p>
            <button
              className="warn"
              disabled={busy}
              onClick={() => {
                if (!confirm(`确认从 ${cardKindLabel(tab)} ${cardAmountLabel(tab)} 队列取出下一张卡密？`)) return;
                run(() =>
                  api("/api/cards", {
                    method: "POST",
                    body: JSON.stringify({ action: "getNextCard", tier: tab }),
                  })
                );
              }}
            >
              取出下一张
            </button>
          </div>

          <div className="card">
            <h3>skipCard(index) — 跳过指定索引</h3>
            <div className="field">
              <label>索引 index</label>
              <input
                value={skipIndex}
                onChange={(e) => setSkipIndex(e.target.value)}
                placeholder="0"
              />
            </div>
            <button
              className="danger"
              disabled={busy || skipIndex === ""}
              onClick={() => {
                if (!confirm(`确认 skipCard(${skipIndex})？不会自动推进 nextIndex。`))
                  return;
                run(() =>
                  api("/api/cards", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "skipCard",
                      tier: tab,
                      index: Number(skipIndex),
                    }),
                  })
                );
              }}
            >
              跳过该索引
            </button>
          </div>

          <div className="card">
            <h3>isCardUsed(index) / isUsed(index)</h3>
            <div className="field">
              <label>索引 index</label>
              <input
                value={checkIndex}
                onChange={(e) => setCheckIndex(e.target.value)}
                placeholder="0"
              />
            </div>
            <button
              disabled={busy || checkIndex === ""}
              onClick={() =>
                run(
                  () =>
                    api("/api/cards", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "isCardUsed",
                        tier: tab,
                        index: Number(checkIndex),
                      }),
                    }),
                  { refresh: false }
                )
              }
            >
              查询是否已用
            </button>
          </div>

          <div className="card">
            <h3>视图快捷查询</h3>
            <div className="row">
              {(["owner", "nextIndex", "remaining", "total"] as const).map(
                (action) => (
                  <button
                    key={action}
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          api("/api/cards", {
                            method: "POST",
                            body: JSON.stringify({ action, tier: tab }),
                          }),
                        { refresh: false }
                      )
                    }
                  >
                    {action}()
                  </button>
                )
              )}
            </div>
          </div>

          <div className="card">
            <h3>transferOwnership / renounceOwnership</h3>
            <div className="field">
              <label>新 Owner 地址（仅 transfer）</label>
              <input
                value={newOwnerCard}
                onChange={(e) => setNewOwnerCard(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="row">
              <button
                className="danger"
                disabled={busy || !newOwnerCard.trim()}
                onClick={() => {
                  if (!confirm("确认转移该卡密合约所有权？")) return;
                  run(() =>
                    api("/api/cards", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "transferOwnership",
                        tier: tab,
                        newOwner: newOwnerCard,
                      }),
                    })
                  );
                }}
              >
                transferOwnership
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(
                      "危险：renounceOwnership 后将无法再管理该合约。确认？"
                    )
                  )
                    return;
                  run(() =>
                    api("/api/cards", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "renounceOwnership",
                        tier: tab,
                      }),
                    })
                  );
                }}
              >
                renounceOwnership
              </button>
            </div>
          </div>
        </>
      )}

      <ResultBox result={result} />
    </div>
  );
}
