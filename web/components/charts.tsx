"use client";

import { useRef, useState } from "react";
import type { ActivityPoint, ActivityRange } from "@/lib/api";

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function fmtTick(iso: string, range: ActivityRange): string {
  const d = new Date(iso);
  if (range === "1h") return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (range === "24h") return d.toLocaleTimeString([], { hour: "numeric" });
  if (range === "7d") return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtFull(iso: string, range: ActivityRange): string {
  const d = new Date(iso);
  return range === "30d" ? d.toLocaleDateString([], { month: "short", day: "numeric" }) : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Requests (orange area) and failed deliveries (red line) over time, with a hover read-out. */
export function TrafficChart({ points, range }: { points: ActivityPoint[]; range: ActivityRange }) {
  const W = 760, H = 250, L = 44, R = 12, T = 10, B = 28;
  const max = niceMax(Math.max(0, ...points.map((p) => Math.max(p.requests, p.failed))));
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => L + (i / n) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = (key: "requests" | "failed") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const area = `${line("requests")} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const empty = points.every((p) => p.requests === 0 && p.failed === 0);
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const xTicks = Array.from({ length: 5 }, (_, k) => Math.round((k / 4) * (points.length - 1)));

  function onMove(e: React.PointerEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r || points.length === 0) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(((px - L) / (W - L - R)) * n))));
  }
  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <div className="mb-2 flex justify-end gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand" />Requests</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-400" />Failed</span>
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Traffic over time">
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ef6a2b" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ef6a2b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6b6b73">{t >= 1000 ? `${t / 1000}k` : t}</text>
          </g>
        ))}
        {xTicks.map((i) => points[i] && (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="11" fill="#6b6b73">{fmtTick(points[i].bucket, range)}</text>
        ))}
        {!empty && <path d={area} fill="url(#areaFill)" />}
        <path d={line("requests")} fill="none" stroke="#ef6a2b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line("failed")} fill="none" stroke="#f87171" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && hp && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 4" />
            <circle cx={x(hover)} cy={y(hp.requests)} r="4" fill="#ef6a2b" stroke="#111113" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(hp.failed)} r="3.5" fill="#f87171" stroke="#111113" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-[8.5rem] rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-xs shadow-xl"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > points.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
        >
          <div className="mb-1 text-zinc-500">{fmtFull(hp.bucket, range)}</div>
          <div className="flex justify-between gap-4 text-zinc-200"><span>Requests</span><b className="tabular-nums">{hp.requests}</b></div>
          <div className="flex justify-between gap-4 text-red-300"><span>Failed</span><b className="tabular-nums">{hp.failed}</b></div>
        </div>
      )}
      {empty && <p className="-mt-1 text-center text-xs text-zinc-600">No traffic in this period yet.</p>}
    </div>
  );
}
