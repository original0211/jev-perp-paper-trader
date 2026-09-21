"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, LineData } from "lightweight-charts";

const COLORS = ["#60a5fa", "#f87171", "#4ade80", "#facc15", "#c084fc", "#38bdf8", "#fb923c", "#f472b6"];

export default function PriceChart({ symbols }: { symbols: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Record<string, ISeriesApi<"Line">>>({});
  const [active, setActive] = useState<string>(symbols[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 280,
      layout: { background: { color: "#0b0e14" }, textColor: "#7a8296" },
      grid: { vertLines: { color: "#1a1f2c" }, horzLines: { color: "#1a1f2c" } },
      rightPriceScale: { borderColor: "#232838" },
      timeScale: { borderColor: "#232838", timeVisible: true },
    });
    chartRef.current = chart;

    const resize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const res = await fetch("/api/chart-data", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive || !chartRef.current) return;

        const nextHasData: Record<string, boolean> = {};
        symbols.forEach((sym, i) => {
          const points = data.symbols?.[sym] ?? [];
          nextHasData[sym] = points.length > 0;
          if (points.length === 0) return;
          let series = seriesRefs.current[sym];
          if (!series) {
            series = chartRef.current!.addLineSeries({
              color: COLORS[i % COLORS.length],
              lineWidth: 2,
              visible: sym === active,
            });
            seriesRefs.current[sym] = series;
          }
          series.setData(points as LineData[]);
        });
        setHasData(nextHasData);
        chartRef.current.timeScale().fitContent();
        setError(null);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err: any) {
        if (alive) setError(err.message);
      }
    }

    poll();
    const id = setInterval(poll, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [symbols, active]);

  useEffect(() => {
    Object.entries(seriesRefs.current).forEach(([sym, series]) => {
      series.applyOptions({ visible: sym === active });
    });
  }, [active]);

  const activeHasData = hasData[active];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {symbols.map((sym) => (
            <button
              key={sym}
              onClick={() => setActive(sym)}
              className={`tag ${active === sym ? "tag-long" : "tag-no"}`}
              style={{ border: "none", cursor: "pointer" }}
            >
              {sym}
            </button>
          ))}
        </div>
        <span className="muted">{lastUpdated ? `最近刷新 ${lastUpdated}` : "加载中..."}</span>
      </div>
      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%" }} />
        {activeHasData === false && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span className="muted">{active} 暂无价格数据，等待下一次数据采集（详见页面底部说明）。</span>
          </div>
        )}
      </div>
      {error && <div className="muted red">价格数据加载异常: {error}</div>}
    </div>
  );
}
