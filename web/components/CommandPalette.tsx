"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/Shell";
import { IconBolt, IconChat, IconCode, IconCog, IconHome, IconKey, IconList, IconPlus, IconReplay, IconSearch } from "@/components/icons";

type Item = { id: string; label: string; hint: string; href: string; icon: React.ComponentType<{ className?: string }>; run?: () => void };

/** Ctrl/Cmd+K: jump to a page or endpoint, or search request payloads. */
export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { endpoints, openFeedback } = useApp();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = [
      { id: "p-new", label: "Create endpoint", hint: "Action", href: "/endpoints/?new=1", icon: IconPlus },
      { id: "p-over", label: "Overview", hint: "Page", href: "/dashboard/", icon: IconHome },
      { id: "p-eps", label: "Endpoints", hint: "Page", href: "/endpoints/", icon: IconCode },
      { id: "p-req", label: "Requests", hint: "Page", href: "/requests/", icon: IconList },
      { id: "p-rep", label: "Replays", hint: "Page", href: "/replays/", icon: IconReplay },
      { id: "p-tun", label: "Tunnels", hint: "Page", href: "/tunnels/", icon: IconBolt },
      { id: "p-key", label: "API Keys", hint: "Page", href: "/keys/", icon: IconKey },
      { id: "p-set", label: "Settings", hint: "Page", href: "/settings/", icon: IconCog },
      { id: "p-fb", label: "Send feedback", hint: "Action", href: "", icon: IconChat, run: openFeedback },
    ];
    const eps: Item[] = (endpoints ?? []).map((e) => ({ id: e.id, label: e.name, hint: "Endpoint", href: `/endpoint/?id=${e.id}`, icon: IconCode }));
    const term = q.trim().toLowerCase();
    const filtered = [...eps, ...pages].filter((i) => !term || i.label.toLowerCase().includes(term));
    if (term) {
      filtered.push({ id: "search", label: `Search requests for “${q.trim()}”`, hint: "Requests", href: `/requests/?q=${encodeURIComponent(q.trim())}`, icon: IconSearch });
    }
    return filtered;
  }, [q, endpoints, openFeedback]);

  useEffect(() => setSel(0), [q]);

  function go(i: Item | undefined) {
    if (!i) return;
    onClose();
    if (i.run) i.run();
    else router.push(i.href);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[14vh]" onKeyDown={(e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); go(items[sel]); }
    }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
          <IconSearch className="text-zinc-500" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search endpoints, pages, request payloads…" className="h-14 w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none" />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-zinc-500">Nothing found.</li>}
          {items.map((i, idx) => {
            const Icon = i.icon;
            return (
              <li key={i.id}>
                <button onMouseEnter={() => setSel(idx)} onClick={() => go(i)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${idx === sel ? "bg-white/[0.07] text-white" : "text-zinc-300"}`}>
                  <Icon className={idx === sel ? "text-brand" : "text-zinc-500"} />
                  <span className="flex-1 truncate">{i.label}</span>
                  <span className="text-xs text-zinc-600">{i.hint}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
