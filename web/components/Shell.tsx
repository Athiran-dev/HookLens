"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, useMe, type MeResponse } from "@/lib/api";
import { Logo, Spinner } from "@/components/ui";
import { createContext, useContext } from "react";

const MeContext = createContext<{ me: MeResponse; refresh: () => void } | null>(null);
export const useMeContext = () => {
  const v = useContext(MeContext);
  if (!v) throw new Error("useMeContext outside Shell");
  return v;
};

const nav = [
  { href: "/dashboard/", label: "Overview" },
  { href: "/endpoints/", label: "Endpoints" },
  { href: "/settings/", label: "Settings" },
  { href: "/docs/", label: "Docs" },
];

/** Authenticated page frame: top nav + session guard. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const { me, refresh } = useMe();
  const path = usePathname();

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <MeContext.Provider value={{ me, refresh }}>
      <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:h-14 sm:py-0">
          <Link href="/dashboard/">
            <Logo />
          </Link>
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:mx-0 sm:w-auto">
            {nav.map((n) => {
              const active = path.startsWith(n.href.replace(/\/$/, "")) || (n.href === "/endpoints/" && path.startsWith("/endpoint"));
              return (
                <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-1.5 transition ${active ? "bg-white/[0.07] text-white shadow-[inset_0_-2px_0_0_#4ade80]" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
            <span className="hidden sm:inline">{me.user.email}</span>
            <button
              className="rounded-md border border-ink-600 px-2.5 py-1 text-slate-300 hover:bg-ink-700"
              onClick={async () => {
                await api("POST", "/api/v1/auth/logout", {}).catch(() => {});
                window.location.href = "/login/";
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </MeContext.Provider>
  );
}
