// Mock data only. No real exchange connection, no real funds.
// Layout mirrors: equity curve, current positions, AI decision log, fills, performance stats.

const mockEquityCurve = [10000, 10000, 9985, 10042, 10120, 10093, 10210, 10305];

const mockPositions = [
  { symbol: "AVAXUSDT", side: "short", entry: 10.05, pnlPct: 0.4, confidence: 34 },
  { symbol: "AVAUSDT", side: "long", entry: 0.237, pnlPct: 0.63, confidence: 59 },
];

const mockDecisions = [
  { symbol: "AVAUSDT", label: "chase_long", confidence: 0.59, time: "09:06:54" },
  { symbol: "AVAXUSDT", label: "hold", confidence: 0.37, time: "09:06:19" },
  { symbol: "AVAXUSDT", label: "chase_short", confidence: 0.34, time: "09:05:14" },
];

const mockFills = [
  { symbol: "AVAUSDT", action: "open_long", price: 0.237, pnl: 0, time: "09:06:54" },
  { symbol: "AVAXUSDT", action: "open_short", price: 10.05, pnl: 0, time: "09:05:14" },
];

function Sparkline({ values }: { values: number[] }) {
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

export default function Page() {
  const equity = mockEquityCurve[mockEquityCurve.length - 1];
  const start = mockEquityCurve[0];
  const pnl = equity - start;

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <strong>TradeGenuis-style Paper Trader</strong>
            <span className="muted"> (JEV, simulation only)</span>
          </div>
          <div>
            账户权益 ${equity.toFixed(2)}{" "}
            <span className={pnl >= 0 ? "green" : "red"}>
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
            </span>
          </div>
        </div>
        <Sparkline values={mockEquityCurve} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <strong>当前持仓 ({mockPositions.length})</strong>
          <table>
            <thead>
              <tr><th>品种</th><th>方向</th><th>开仓成本</th><th>盈亏%</th><th>置信度</th></tr>
            </thead>
            <tbody>
              {mockPositions.map((p) => (
                <tr key={p.symbol}>
                  <td>{p.symbol}</td>
                  <td>{p.side}</td>
                  <td>{p.entry}</td>
                  <td className={p.pnlPct >= 0 ? "green" : "red"}>{p.pnlPct}%</td>
                  <td>{p.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <strong>AI 决策</strong>
          <table>
            <thead>
              <tr><th>品种</th><th>结论</th><th>置信</th><th>时间</th></tr>
            </thead>
            <tbody>
              {mockDecisions.map((d, i) => (
                <tr key={i}>
                  <td>{d.symbol}</td>
                  <td>{d.label}</td>
                  <td>{d.confidence}</td>
                  <td className="muted">{d.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <strong>成交记录</strong>
        <table>
          <thead>
            <tr><th>品种</th><th>动作</th><th>价格</th><th>盈亏</th><th>时间</th></tr>
          </thead>
          <tbody>
            {mockFills.map((f, i) => (
              <tr key={i}>
                <td>{f.symbol}</td>
                <td>{f.action}</td>
                <td>{f.price}</td>
                <td>{f.pnl}</td>
                <td className="muted">{f.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted">
        全部为模拟数据（simulation only）。尚未连接真实交易所账户或真实资金。
      </p>
    </main>
  );
}
