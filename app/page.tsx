import { query } from "@/lib/db";
import LogStream from "@/components/LogStream";
import EquityChart from "@/components/EquityChart";
import PriceChart from "@/components/PriceChart";
import { WATCHLIST } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

interface PositionRow {
  symbol: string;
  side: "long" | "short";
  entry_price: string;
  size: string;
  opened_at: string;
}

interface DecisionRow {
  symbol: string;
  size_tier: number | null;
  confidence: string | null;
  needs_human_approval: boolean | null;
  decided_at: string;
}

interface FillRow {
  symbol: string;
  side: string | null;
  action: string;
  price: string;
  pnl: string;
  filled_at: string;
}

interface SnapshotRow {
  equity: string;
  realized_pnl: string;
  unrealized_pnl: string;
  win_rate: string | null;
  snapshot_at: string;
}

const STARTING_EQUITY = 10000;

function SideTag({ side }: { side: string | null }) {
  if (!side) return <span className="muted">-</span>;
  const isLong = side === "long";
  return <span className={`tag ${isLong ? "tag-long" : "tag-short"}`}>{isLong ? "多" : "空"}</span>;
}

function ApprovalTag({ needsApproval }: { needsApproval: boolean | null }) {
  if (needsApproval == null) return <span className="muted">-</span>;
  return (
    <span className={`tag ${needsApproval ? "tag-yes" : "tag-no"}`}>
      {needsApproval ? "需审批" : "否"}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value == null) return <span className="muted">-</span>;
  const pct = Math.round(value * 100);
  return (
    <span>
      <span className="confidence-bar">
        <span className="confidence-fill" style={{ width: `${pct}%` }} />
      </span>
      {pct}%
    </span>
  );
}

export default async function Page() {
  const [positions, decisions, fills, snapshots, closedFills] = await Promise.all([
    query<PositionRow>(
      "SELECT symbol, side, entry_price, size, opened_at FROM positions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 20"
    ),
    query<DecisionRow>(
      "SELECT symbol, size_tier, confidence, needs_human_approval, decided_at FROM ai_decisions ORDER BY decided_at DESC LIMIT 10"
    ),
    query<FillRow>(
      "SELECT symbol, side, action, price, pnl, filled_at FROM fills ORDER BY filled_at DESC LIMIT 10"
    ),
    query<SnapshotRow>(
      "SELECT equity, realized_pnl, unrealized_pnl, win_rate, snapshot_at FROM performance_snapshots ORDER BY snapshot_at ASC LIMIT 200"
    ),
    query<FillRow>("SELECT symbol, side, action, price, pnl, filled_at FROM fills WHERE action = 'close'"),
  ]);

  const equityCurve = snapshots.length > 0 ? snapshots.map((s) => Number(s.equity)) : [STARTING_EQUITY];
  const equity = equityCurve[equityCurve.length - 1];
  const pnl = equity - STARTING_EQUITY;

  const closed = closedFills.map((f) => ({ ...f, pnl: Number(f.pnl) }));
  const totalTrades = closed.length;
  const wins = closed.filter((f) => f.pnl > 0);
  const losses = closed.filter((f) => f.pnl <= 0);
  const totalPnl = closed.reduce((s, f) => s + f.pnl, 0);
  const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;
  const grossProfit = wins.reduce((s, f) => s + f.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, f) => s + f.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const longClosed = closed.filter((f) => f.side === "long");
  const shortClosed = closed.filter((f) => f.side === "short");
  const longPnl = longClosed.reduce((s, f) => s + f.pnl, 0);
  const shortPnl = shortClosed.reduce((s, f) => s + f.pnl, 0);
  const longWinRate = longClosed.length > 0 ? longClosed.filter((f) => f.pnl > 0).length / longClosed.length : 0;
  const shortWinRate = shortClosed.length > 0 ? shortClosed.filter((f) => f.pnl > 0).length / shortClosed.length : 0;

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <strong>Jev Perp Paper Trader</strong>
            <span className="muted"> (simulation only, live from Neon)</span>
          </div>
          <div>
            账户权益 ${equity.toFixed(2)}{" "}
            <span className={pnl >= 0 ? "green" : "red"}>
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
            </span>
          </div>
        </div>
        <EquityChart />
      </div>

      <div className="card">
        <strong>多品种行情</strong>
        <div style={{ marginTop: 10 }}>
          <PriceChart symbols={Object.keys(WATCHLIST)} />
        </div>
      </div>

      <LogStream />

      <div className="card">
        <strong>交易绩效</strong>
        <div className="stat-grid" style={{ marginTop: 10 }}>
          <div className="stat-box">
            <div className="stat-label">总盈亏金额</div>
            <div className={`stat-value ${totalPnl >= 0 ? "green" : "red"}`}>{totalPnl.toFixed(2)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">总交易笔数</div>
            <div className="stat-value">{totalTrades}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">胜率</div>
            <div className="stat-value">{(winRate * 100).toFixed(1)}%</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">盈亏比（总盈利/总盈损）</div>
            <div className="stat-value">{profitFactor === Infinity ? "—" : profitFactor.toFixed(2)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">多头 笔数 / 胜率</div>
            <div className="stat-value">
              {longClosed.length} <span className="muted" style={{ fontSize: 12 }}>/ {(longWinRate * 100).toFixed(0)}%</span>
            </div>
            <div className={longPnl >= 0 ? "green" : "red"} style={{ fontSize: 12 }}>盈亏 {longPnl.toFixed(2)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">空头 笔数 / 胜率</div>
            <div className="stat-value">
              {shortClosed.length} <span className="muted" style={{ fontSize: 12 }}>/ {(shortWinRate * 100).toFixed(0)}%</span>
            </div>
            <div className={shortPnl >= 0 ? "green" : "red"} style={{ fontSize: 12 }}>盈亏 {shortPnl.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <strong>当前持仓 ({positions.length})</strong>
          {positions.length === 0 ? (
            <p className="muted">NO POSITION — 尚未写入任何持仓记录。</p>
          ) : (
            <table>
              <thead>
                <tr><th>品种</th><th>方向</th><th>开仓成本</th><th>数量</th><th>开仓时间</th></tr>
              </thead>
              <tbody>
                {positions.map((p, i) => (
                  <tr key={i}>
                    <td>{p.symbol}</td>
                    <td><SideTag side={p.side} /></td>
                    <td>{p.entry_price}</td>
                    <td>{p.size}</td>
                    <td className="muted">{new Date(p.opened_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <strong>AI 决策</strong>
          {decisions.length === 0 ? (
            <p className="muted">NO DECISION — 暂无决策记录。</p>
          ) : (
            <table>
              <thead>
                <tr><th>品种</th><th>档位</th><th>置信</th><th>审批</th><th>时间</th></tr>
              </thead>
              <tbody>
                {decisions.map((d, i) => (
                  <tr key={i}>
                    <td>{d.symbol}</td>
                    <td>{d.size_tier ?? "-"}</td>
                    <td><ConfidenceBar value={d.confidence != null ? Number(d.confidence) : null} /></td>
                    <td><ApprovalTag needsApproval={d.needs_human_approval} /></td>
                    <td className="muted">{new Date(d.decided_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <strong>成交记录</strong>
        {fills.length === 0 ? (
          <p className="muted">NO FILL — 暂无成交记录。</p>
        ) : (
          <table>
            <thead>
              <tr><th>品种</th><th>方向</th><th>动作</th><th>价格</th><th>盈亏</th><th>时间</th></tr>
            </thead>
            <tbody>
              {fills.map((f, i) => (
                <tr key={i}>
                  <td>{f.symbol}</td>
                  <td><SideTag side={f.side} /></td>
                  <td>{f.action}</td>
                  <td>{f.price}</td>
                  <td className={Number(f.pnl) >= 0 ? "green" : "red"}>{Number(f.pnl).toFixed(2)}</td>
                  <td className="muted">{new Date(f.filled_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="muted">
        数据实时从 Neon Postgres 读取。全部为模拟数据，未连接真实交易所账户或真实资金。
      </p>
    </main>
  );
}
