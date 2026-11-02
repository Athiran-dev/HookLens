"use client";

import { useState } from "react";
import type { DeliveryBrief } from "@/lib/api";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-white ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="#34d399" strokeWidth="2" />
        <path d="M7 12h10M13 8l4 4-4 4" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      HookLens
    </span>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "outline" }) {
  const styles = {
    primary: "bg-brand text-ink-950 hover:bg-emerald-300 font-semibold",
    ghost: "text-slate-300 hover:bg-ink-700",
    outline: "border border-ink-600 text-slate-200 hover:bg-ink-700",
    danger: "border border-red-500/40 text-red-300 hover:bg-red-500/10",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-lg border border-ink-700 bg-ink-800 ${className}`}>{children}</div>;
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-brand" />;
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{children}</p>;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      className="!px-2.5 !py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

const methodColors: Record<string, string> = {
  GET: "text-sky-300 bg-sky-400/10",
  POST: "text-emerald-300 bg-emerald-400/10",
  PUT: "text-amber-300 bg-amber-400/10",
  PATCH: "text-amber-300 bg-amber-400/10",
  DELETE: "text-red-300 bg-red-400/10",
};

export function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${methodColors[method] ?? "text-slate-300 bg-slate-400/10"}`}>
      {method}
    </span>
  );
}

export function DeliveryBadge({ d }: { d: DeliveryBrief | null }) {
  if (!d) return <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[11px] text-slate-400">captured</span>;
  const base = "rounded px-1.5 py-0.5 text-[11px] font-medium";
  const replay = d.kind === "replay" ? " · replay" : "";
  switch (d.status) {
    case "delivered":
      return <span className={`${base} bg-emerald-400/10 text-emerald-300`}>{d.response_code ?? "ok"}{replay}</span>;
    case "failed":
      return <span className={`${base} bg-red-400/10 text-red-300`}>{d.response_code ?? "failed"}{replay}</span>;
    case "pending":
      return <span className={`${base} bg-amber-400/10 text-amber-300`}>forwarding…</span>;
    default:
      return <span className={`${base} bg-slate-500/10 text-slate-400`}>not forwarded</span>;
  }
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
