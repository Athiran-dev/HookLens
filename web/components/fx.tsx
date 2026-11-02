"use client";

import { useEffect, useRef, useState } from "react";

/** Fades/slides children in once they scroll into view. */
export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${seen ? "in" : ""} ${className}`} style={{ ["--d" as string]: `${delay}ms` }}>
      {children}
    </div>
  );
}

const TOKEN = /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

/** Syntax-highlighted JSON (or plain text when the body is not JSON). Never uses innerHTML. */
export function JsonView({ text, className = "" }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    let cls = "text-amber-300"; // numbers
    if (t.startsWith('"')) cls = t.endsWith(":") ? "text-orange-300" : "text-emerald-300";
    else if (/^(true|false)$/.test(t)) cls = "text-fuchsia-300";
    else if (t === "null") cls = "text-slate-500";
    parts.push(<span key={m.index} className={cls}>{t}</span>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <pre className={`max-h-[28rem] overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/[0.06] bg-black/30 p-4 text-[12.5px] leading-relaxed text-slate-300 ${className}`}>
      {parts}
    </pre>
  );
}

/** 24-hour traffic bars: total requests with failed deliveries overlaid. */
export function ActivityChart({ points }: { points: { hour: string; total: number; failed: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.total));
  const W = 720;
  const H = 120;
  const bw = W / Math.max(points.length, 1);
  const empty = points.every((p) => p.total === 0);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Requests per hour, last 24 hours">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 5" />
        ))}
        {points.map((p, i) => {
          const h = Math.max(p.total ? 3 : 1, (p.total / max) * H);
          const fh = (p.failed / max) * H;
          const x = i * bw + 3;
          const d = new Date(p.hour);
          return (
            <g key={p.hour}>
              <title>{`${d.toLocaleTimeString([], { hour: "numeric" })}: ${p.total} request${p.total === 1 ? "" : "s"}${p.failed ? `, ${p.failed} failed` : ""}`}</title>
              <rect x={x} y={H - h} width={bw - 6} height={h} rx="3" fill={p.total ? "rgba(239,106,43,0.85)" : "rgba(255,255,255,0.06)"} className="bar-grow" style={{ animationDelay: `${i * 18}ms` }} />
              {fh > 0 && <rect x={x} y={H - fh} width={bw - 6} height={fh} rx="3" fill="rgba(248,113,113,0.9)" className="bar-grow" style={{ animationDelay: `${i * 18 + 120}ms` }} />}
              {i % 6 === 0 && (
                <text x={x} y={H + 14} fontSize="10" fill="#5b6475">{d.toLocaleTimeString([], { hour: "numeric" })}</text>
              )}
            </g>
          );
        })}
      </svg>
      {empty && <p className="-mt-2 text-center text-xs text-slate-500">No traffic in the last 24 hours.</p>}
    </div>
  );
}

/** Counts up/down to `value` with an ease-out curve (inspired by Magic UI's Number Ticker). */
export function NumberTicker({ value, className = "" }: { value: number; className?: string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return setShown(value);
    const start = performance.now();
    const base = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(base + (value - base) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`tabular-nums ${className}`}>{shown.toLocaleString()}</span>;
}
