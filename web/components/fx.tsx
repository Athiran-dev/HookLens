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
    if (t.startsWith('"')) cls = t.endsWith(":") ? "text-sky-300" : "text-emerald-300";
    else if (/^(true|false)$/.test(t)) cls = "text-fuchsia-300";
    else if (t === "null") cls = "text-slate-500";
    parts.push(<span key={m.index} className={cls}>{t}</span>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <pre className={`max-h-[28rem] overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/5 bg-black/40 p-4 text-[12.5px] leading-relaxed text-slate-300 ${className}`}>
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
              <rect x={x} y={H - h} width={bw - 6} height={h} rx="3" fill={p.total ? "rgba(74,222,128,0.75)" : "rgba(255,255,255,0.06)"} className="bar-grow" style={{ animationDelay: `${i * 18}ms` }} />
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

/** Animated packets flowing provider -> HookLens -> localhost, with the replay loop underneath. */
export function PipelineHero() {
  const route = "M 95 110 L 330 110 L 565 110";
  const dots = [0, 1.4, 2.8];
  return (
    <svg viewBox="0 0 660 220" className="mx-auto w-full max-w-3xl" role="img" aria-label="A webhook travels from a provider through HookLens to your localhost, and can be replayed">
      <defs>
        <linearGradient id="beam" x1="0" x2="1">
          <stop offset="0" stopColor="#4ade80" stopOpacity="0" />
          <stop offset="0.5" stopColor="#4ade80" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0.25" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={route} stroke="url(#beam)" strokeWidth="2" fill="none" strokeDasharray="2 7" />
      <path d="M 565 128 C 565 200, 330 200, 330 130" stroke="rgba(251,191,36,0.35)" strokeWidth="1.5" fill="none" strokeDasharray="4 6" />
      <text x="460" y="205" fill="#fbbf24" fillOpacity="0.8" fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">replay</text>
      {dots.map((d) => (
        <circle key={d} r="5" fill="#4ade80" filter="url(#glow)">
          <animateMotion dur="4.2s" begin={`${d}s`} repeatCount="indefinite" path={route} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.25 1" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.92;1" dur="4.2s" begin={`${d}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {[
        { x: 95, label: "Your provider", sub: "Stripe · Razorpay · …" },
        { x: 330, label: "HookLens", sub: "stores · acks · forwards" },
        { x: 565, label: "localhost:3000", sub: "your app" },
      ].map((n, i) => (
        <g key={n.x}>
          <circle cx={n.x} cy="110" r="22" fill="#0c0e12" stroke={i === 1 ? "#4ade80" : "rgba(255,255,255,0.18)"} strokeWidth="1.5" />
          {i === 1 && <circle cx={n.x} cy="110" r="30" fill="none" stroke="#4ade80" strokeOpacity="0.25" />}
          <circle cx={n.x} cy="110" r="5" fill={i === 1 ? "#4ade80" : "#94a3b8"} />
          <text x={n.x} y="62" textAnchor="middle" fill="#e2e8f0" fontSize="12.5" fontWeight="600" fontFamily="var(--font-display)">{n.label}</text>
          <text x={n.x} y="78" textAnchor="middle" fill="#64748b" fontSize="10.5" fontFamily="var(--font-mono)">{n.sub}</text>
        </g>
      ))}
    </svg>
  );
}

const SAMPLES = [
  { m: "POST", p: "/webhooks/stripe", code: 200, body: { id: "evt_1Pq", type: "invoice.paid", data: { amount_paid: 4900, currency: "usd", paid: true } } },
  { m: "POST", p: "/webhooks/razorpay", code: 500, body: { event: "payment.captured", payment: { id: "pay_123", amount: 50000, currency: "INR", status: "captured" } } },
  { m: "POST", p: "/webhooks/razorpay", code: 200, replay: true, body: { event: "payment.captured", payment: { id: "pay_123", amount: 50000, currency: "INR", status: "captured" } } },
  { m: "POST", p: "/webhooks/github", code: 200, body: { action: "opened", pull_request: { number: 42, draft: false, merged: null } } },
];

/** A self-playing illustration of the request inspector (sample data, not live). */
export function MockInspector() {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return setN(SAMPLES.length);
    const t = setInterval(() => setN((x) => (x % (SAMPLES.length + 2)) + 1), 2400);
    return () => clearInterval(t);
  }, []);
  const shown = SAMPLES.slice(0, Math.min(n, SAMPLES.length));
  const sel = shown[shown.length - 1];
  return (
    <div className="glass beam overflow-hidden rounded-2xl text-left">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5 text-xs text-slate-400">
        <span className="live-dot" /> Live · Razorpay Testing
        <span className="ml-auto text-slate-600">sample data</span>
      </div>
      <div className="grid md:grid-cols-[15rem_1fr]">
        <ul className="min-h-[13rem] divide-y divide-white/5 border-white/5 md:border-r">
          {[...shown].reverse().map((s, i) => (
            <li key={shown.length - i + s.p + s.code} className={`${i === 0 ? "row-in bg-white/[0.04]" : ""} flex items-center gap-2 px-3 py-2.5 text-xs`}>
              <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">{s.m}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-slate-300">{s.p}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${s.code >= 400 ? "bg-red-400/10 text-red-300" : "bg-emerald-400/10 text-emerald-300"}`}>
                {s.code}{s.replay ? " · replay" : ""}
              </span>
            </li>
          ))}
        </ul>
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className="font-mono text-slate-200">{sel.p}</span>
            {sel.replay && <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">replayed after fix</span>}
          </div>
          <JsonView key={n} text={JSON.stringify(sel.body, null, 2)} className="!max-h-48 row-in" />
        </div>
      </div>
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
