"use client";

import { useEffect, useState } from "react";

interface LogEvent {
  ts: string;
  level: "info" | "success" | "danger" | "warn";
  text: string;
}

const LEVEL_LABEL: Record<string, string> = {
  info: "INFO",
  success: "OK",
  danger: "ERR",
  warn: "WARN",
};

export default function LogStream() {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/logs", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (active) {
          setEvents(data.events ?? []);
          setLastFetch(new Date().toLocaleTimeString());
          setError(null);
        }
      } catch (err: any) {
        if (active) setError(err.message);
      }
    }

    poll();
    const id = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>实时日志流</strong>
        <span className="muted">
          {error ? (
            <span className="red">连接异常: {error}</span>
          ) : lastFetch ? (
            `最近刷新 ${lastFetch}`
          ) : (
            "连接中..."
          )}
        </span>
      </div>
      <div className="log-panel">
        {events.length === 0 ? (
          <div className="muted">暂无日志事件。</div>
        ) : (
          events.map((e, i) => (
            <div className="log-line" key={i}>
              <span className="log-time">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className={`log-badge log-${e.level}`}>{LEVEL_LABEL[e.level] ?? "INFO"}</span>
              <span className="log-text">{e.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
