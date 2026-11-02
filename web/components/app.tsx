"use client";

import Link from "next/link";
import { useState } from "react";
import type { DeliveryBrief } from "@/lib/api";
import { IconCheck, IconChevron, IconCopy } from "@/components/icons";

export function PageHeader({ crumbs, title, subtitle, children }: { crumbs: string[]; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <nav className="mb-3 flex items-center gap-2 text-sm text-zinc-500">
        {crumbs.map((c, i) => (
          <span key={c} className="flex items-center gap-2">
            {i > 0 && <IconChevron className="h-3 w-3 text-zinc-700" />}
            <span className={i === crumbs.length - 1 ? "text-zinc-300" : ""}>{c}</span>
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-[15px] text-zinc-400">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
      </div>
    </div>
  );
}

export function Panel({
  title, icon, action, children, className = "", flush = false,
}: { title?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`min-w-0 rounded-xl border border-white/[0.09] bg-[#111113] ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-zinc-100">
            {icon && <span className="text-brand">{icon}</span>}
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function LinkAction({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="whitespace-nowrap text-sm font-medium text-brand hover:text-brand-soft">{children} →</Link>;
}

/** Dense table primitives: use <table className={tbl}> with <Th> / <Td>. */
export const tbl = "w-full min-w-[640px] text-left text-sm";
export const Th = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <th className={`whitespace-nowrap px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 ${className}`}>{children}</th>
);
export const Td = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <td className={`px-5 py-3 align-middle text-zinc-300 ${className}`}>{children}</td>
);
export const TableWrap = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto"><div className="min-w-0">{children}</div></div>
);

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${value === o.value ? "bg-brand/15 text-brand ring-1 ring-brand/40" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { Select } from "@/components/select";

export function EmptyState({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 h-px w-10 bg-brand/70" />
      <h3 className="font-display text-xl font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{text}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  );
}

export function CopyIconButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/[0.07] hover:text-zinc-100"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? <IconCheck className="text-emerald-400" /> : <IconCopy />}
    </button>
  );
}

/** Terminal-style block with a copy button; children are the lines. */
export function TerminalBlock({ copy, children, title = "terminal" }: { copy?: string; children: React.ReactNode; title?: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0b0b0c]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2">
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-white/15" /><i className="h-2 w-2 rounded-full bg-white/15" /><i className="h-2 w-2 rounded-full bg-white/15" />
          <span className="ml-2 text-[11px] text-zinc-600">{title}</span>
        </span>
        {copy && <CopyIconButton text={copy} />}
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200">{children}</pre>
    </div>
  );
}

export function StatusDot({ delivery }: { delivery: DeliveryBrief | null }) {
  if (!delivery) return <span className="inline-flex items-center gap-2 whitespace-nowrap text-zinc-500"><i className="h-1.5 w-1.5 rounded-full bg-zinc-600" />Captured</span>;
  const code = delivery.response_code;
  switch (delivery.status) {
    case "delivered":
      return <span className="inline-flex items-center gap-2 whitespace-nowrap text-emerald-400"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{code ?? "OK"}</span>;
    case "failed":
      return <span className="inline-flex items-center gap-2 whitespace-nowrap text-red-400"><i className="h-1.5 w-1.5 rounded-full bg-red-400" />{code ?? "Failed"}</span>;
    case "pending":
      return <span className="inline-flex items-center gap-2 whitespace-nowrap text-amber-300"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />Forwarding</span>;
    default:
      return <span className="inline-flex items-center gap-2 whitespace-nowrap text-zinc-500"><i className="h-1.5 w-1.5 rounded-full bg-zinc-600" />Not forwarded</span>;
  }
}

export function Pill({ tone, children }: { tone: "green" | "red" | "amber" | "gray" | "orange"; children: React.ReactNode }) {
  const c = {
    green: "bg-emerald-400/10 text-emerald-300",
    red: "bg-red-400/10 text-red-300",
    amber: "bg-amber-400/10 text-amber-300",
    gray: "bg-white/[0.06] text-zinc-400",
    orange: "bg-brand/15 text-brand",
  }[tone];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

export function Modal({ title, onClose, children, width = "max-w-md" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label={title} className={`relative w-full ${width} rounded-2xl border border-white/10 bg-[#121214] shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200" aria-label="Close">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-zinc-600">{hint}</span>}
    </label>
  );
}
