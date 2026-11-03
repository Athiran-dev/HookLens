"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, useLive, useMe, type Endpoint, type MeResponse } from "@/lib/api";
import { Logo, Spinner } from "@/components/ui";
import {
  IconBolt, IconBook, IconChat, IconCode, IconCog, IconHome, IconKey, IconList, IconMenu, IconPlus, IconReplay, IconSearch, IconX,
} from "@/components/icons";
import CommandPalette from "@/components/CommandPalette";
import FeedbackDialog from "@/components/FeedbackDialog";
import { ToastProvider } from "@/components/toast";

type AppCtx = {
  me: MeResponse;
  refresh: () => void;
  endpoints: Endpoint[] | null;
  reloadEndpoints: () => Promise<void>;
  openPalette: () => void;
  openFeedback: () => void;
};
const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside Shell");
  return v;
};
/** Back-compat for pages that only need the account. */
export const useMeContext = useApp;

const nav = [
  { group: "Workspace", items: [
    { href: "/dashboard/", label: "Overview", icon: IconHome },
    { href: "/endpoints/", label: "Endpoints", icon: IconCode },
    { href: "/requests/", label: "Requests", icon: IconList },
    { href: "/replays/", label: "Replays", icon: IconReplay },
    { href: "/tunnels/", label: "Tunnels", icon: IconBolt },
  ] },
  { group: "Configuration", items: [
    { href: "/keys/", label: "API Keys", icon: IconKey },
    { href: "/settings/", label: "Settings", icon: IconCog },
  ] },
  { group: "Resources", items: [
    { href: "/docs/", label: "Documentation", icon: IconBook },
    { href: "#feedback", label: "Send feedback", icon: IconChat },
  ] },
];

function isActive(path: string, href: string) {
  const base = href.replace(/\/$/, "");
  if (href === "/endpoints/") return path.startsWith("/endpoints") || path.startsWith("/endpoint");
  return path === base || path.startsWith(base + "/");
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { me, endpoints, openFeedback } = useApp();
  const groups = nav.map((g) => (g.group === "Configuration" && me.is_admin ? { ...g, items: [...g.items, { href: "/admin/", label: "Admin", icon: IconList }] } : g));
  const used = endpoints?.length ?? 0;
  const max = me.limits.max_endpoints;
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Link href="/dashboard/" onClick={onNavigate}><Logo height={26} /></Link>
      </div>
      <div className="mx-4 mb-5 flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-zinc-200">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[11px] font-semibold">P</span>
        Personal Workspace
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3">
        {groups.map((g) => (
          <div key={g.group}>
            <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{g.group}</div>
            {g.items.map((n) => {
              const active = isActive(path, n.href);
              const Icon = n.icon;
              if (n.href === "#feedback") {
                return (
                  <button key={n.href} onClick={() => { onNavigate?.(); openFeedback(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100">
                    <Icon />
                    {n.label}
                  </button>
                );
              }
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={onNavigate}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-brand/[0.12] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"}`}
                >
                  {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" />}
                  <Icon className={active ? "text-brand" : ""} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-zinc-200">Free plan</span>
          <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">Beta</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Endpoints</span>
          <span className="tabular-nums text-zinc-300">{used} / {max}</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.min(100, (used / Math.max(max, 1)) * 100)}%` }} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">Everything is free while HookLens is in beta.</p>
      </div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { me, openPalette } = useApp();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const initial = me.user.email[0]?.toUpperCase() ?? "?";
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#0a0a0b]/85 px-4 backdrop-blur-xl sm:px-6">
      <button className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 lg:hidden" onClick={onMenu} aria-label="Open menu"><IconMenu /></button>
      <button
        onClick={openPalette}
        className="mx-auto flex h-10 w-full max-w-xl items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-zinc-500 transition hover:border-white/20 hover:bg-white/[0.05]"
      >
        <IconSearch className="shrink-0" />
        <span className="flex-1 truncate text-left">Search requests, endpoints…</span>
        <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:block">Ctrl K</kbd>
      </button>
      <button
        onClick={() => router.push("/endpoints/?new=1")}
        className="btn-glow hidden shrink-0 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink-950 sm:inline-flex"
      >
        <IconPlus /> Create Endpoint
      </button>
      <div className="relative">
        <button onClick={() => setMenu((m) => !m)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/15" aria-label="Account menu">
          {initial}
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-11 z-50 w-60 rounded-xl border border-white/10 bg-[#141416] p-1.5 shadow-2xl">
              <div className="border-b border-white/[0.06] px-3 py-2.5">
                <div className="truncate text-sm text-zinc-100">{me.user.email}</div>
                <div className="text-[11px] text-zinc-500">Free plan · beta</div>
              </div>
              <Link href="/settings/" onClick={() => setMenu(false)} className="mt-1 block rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Settings</Link>
              <Link href="/keys/" onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">API keys</Link>
              <button
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/5"
                onClick={async () => {
                  await api("POST", "/api/v1/auth/logout", {}).catch(() => {});
                  window.location.href = "/login/";
                }}
              >
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

/** Authenticated app frame: sidebar, top bar, command palette and shared account/endpoint state. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const { me, refresh } = useMe();
  const [endpoints, setEndpoints] = useState<Endpoint[] | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const path = usePathname();

  const reloadEndpoints = useCallback(async () => {
    try {
      setEndpoints(await api<Endpoint[]>("GET", "/api/v1/endpoints"));
    } catch {
      setEndpoints((e) => e ?? []);
    }
  }, []);
  useEffect(() => {
    if (me) reloadEndpoints();
  }, [me, reloadEndpoints]);

  useLive((ev) => {
    if (ev.type === "tunnel") setEndpoints((l) => l?.map((e) => (e.id === ev.endpoint_id ? { ...e, tunnel_connected: ev.connected } : e)) ?? l);
    if (ev.type === "request") setEndpoints((l) => l?.map((e) => (e.id === ev.request.endpoint_id ? { ...e, request_count: e.request_count + 1, last_request_at: ev.request.received_at } : e)) ?? l);
  });

  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => (me ? { me, refresh, endpoints, reloadEndpoints, openPalette: () => setPalette(true), openFeedback: () => setFeedback(true) } : null),
    [me, refresh, endpoints, reloadEndpoints],
  );

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <Ctx.Provider value={value}>
      <ToastProvider>
      <div className="min-h-screen lg:pl-64">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/[0.06] bg-[#0c0c0e] lg:block">
          <Sidebar />
        </aside>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/10 bg-[#0c0c0e]">
              <button className="absolute right-3 top-4 rounded-lg p-2 text-zinc-400 hover:bg-white/5" onClick={() => setDrawer(false)} aria-label="Close menu"><IconX /></button>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}
        <TopBar onMenu={() => setDrawer(true)} />
        <main className="px-4 py-7 sm:px-6 lg:px-8">{children}</main>
      </div>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      {feedback && <FeedbackDialog onClose={() => setFeedback(false)} />}
      </ToastProvider>
    </Ctx.Provider>
  );
}
