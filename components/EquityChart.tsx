"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, LineData } from "lightweight-charts";

export default function EquityChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 260,
      layout: { background: { color: "#0b0e14" }, textColor: "#7a8296" },
      grid: { vertLines: { color: "#1a1f2c" }, horzLines: { color: "#1a1f2c" } },
      rightPriceScale: { borderColor: "#232838" },
      timeScale: { borderColor: "#232838", timeVisible: true },
    });
    const series = chart.addAreaSeries({
      lineColor: "#4ade80",
      topColor: "rgba(74, 222, 128, 0.28)",
      bottomColor: "rgba(74, 222, 128, 0.02)",
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/chart-data", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (active && seriesRef.current && Array.isArray(data.equity) && data.equity.length > 0) {
          seriesRef.current.setData(data.equity as LineData[]);
          chartRef.current?.timeScale().fitContent();
          setError(null);
        }
      } catch (err: any) {
        if (active) setError(err.message);
      }
    }

    poll();
    const id = setInterval(poll, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <div ref={containerRef} style={{ width: "100%" }} />
      {error && <div className="muted red">图表数据加载异常: {error}</div>}
    </div>
  );
}
