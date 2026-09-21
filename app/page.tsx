import { query } from "@/lib/db";

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

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="muted">暂无净值历史记录（尚未产生 performance_snapshots 数据）。</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / (max - min || 1)) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 120 }}>
      <polyline points={points} fill="none" stroke="#4ade80" strokeWidth={2} />
    </svg>
  );
}

export default async function Page() {
  const [positions, decisions, fills, snapshots] = await Promise.all([
    query<PositionRow>(
      "SELECT symbol, side, entry_price, size, opened_at FROM positions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 20"
    ),
    query<DecisionRow>(
      "SELECT symbol, size_tier, confidence, needs_human_approval, decided_at FROM ai_decisions ORDER BY decided_at DESC LIMIT 10"
    ),
    query<FillRow>(
      "SELECT symbol, action, price, pnl, filled_at FROM fills ORDER BY filled_at DESC LIMIT 10"
    ),
    query<SnapshotRow>(
      "SELECT equity, realized_pnl, unrealized_pnl, win_rate, snapshot_at FROM performance_snapshots ORDER BY snapshot_at ASC LIMIT 200"
    ),
  ]);

  const equityCurve = snapshots.length > 0 ? snapshots.map((s) => Number(s.equity)) : [STARTING_EQUITY];
  const equity = equityCurve[equityCurve.length - 1];
  const pnl = equity - STARTING_EQUITY;

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
        <Sparkline values={equityCurve} />
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
                    <td>{p.side}</td>
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
                <tr><th>品种</th><th>档位</th><th>置信</th><th>需人工审批</th><th>时间</th></tr>
              </thead>
              <tbody>
                {decisions.map((d, i) => (
                  <tr key={i}>
                    <td>{d.symbol}</td>
                    <td>{d.size_tier ?? "-"}</td>
                    <td>{d.confidence ?? "-"}</td>
                    <td>{d.needs_human_approval ? "是" : "否"}</td>
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
              <tr><th>品种</th><th>动作</th><th>价格</th><th>盈亏</th><th>时间</th></tr>
            </thead>
            <tbody>
              {fills.map((f, i) => (
                <tr key={i}>
                  <td>{f.symbol}</td>
                  <td>{f.action}</td>
                  <td>{f.price}</td>
                  <td>{f.pnl}</td>
                  <td className="muted">{new Date(f.filled_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="muted">
        数据实时从 Neon Postgres 读取。目前表为空，因为还没有实际写入任何模拟交易数据。全部为模拟数据，未连接真实交易所账户或真实资金。
      </p>
    </main>
  );
}
