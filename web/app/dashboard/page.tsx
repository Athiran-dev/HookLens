"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Card, DeliveryBadge, MethodBadge, PageTitle } from "@/components/ui";
import { ActivityChart, NumberTicker } from "@/components/fx";
import { api, formatBytes, timeAgo, useLive, type Endpoint, type RequestSummary, type Stats } from "@/lib/api";

function Stat({ label, value, tone = "text-white", i = 0 }: { label: string; value: number | string; tone?: string; i?: number }) {
  return (
    <div className="rise" style={{ ["--d" as string]: `${80 + i * 60}ms` }}>
      <Card className={`p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/15 ${tone === "text-brand" ? "beam" : ""}`}>
        <div className="text-[11px] uppercase tracking-widest text-slate-500">{label}</div>
        <div className={`font-display mt-1.5 text-3xl font-semibold tabular-nums ${tone}`}>{typeof value === "number" ? <NumberTicker value={value} /> : value}</div>
      </Card>
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tunnels, setTunnels] = useState(0);
  const [recent, setRecent] = useState<RequestSummary[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activity, setActivity] = useState<{ hour: string; total: number; failed: number }[]>([]);

  const load = useCallback(async () => {
    const [s, r, e, a] = await Promise.all([
      api<{ stats: Stats; active_tunnels: number }>("GET", "/api/v1/stats"),
      api<RequestSummary[]>("GET", "/api/v1/requests?limit=12"),
      api<Endpoint[]>("GET", "/api/v1/endpoints"),
      api<{ hour: string; total: number; failed: number }[]>("GET", "/api/v1/stats/activity").catch(() => []),
    ]);
    setStats(s.stats);
    setTunnels(s.active_tunnels);
    setRecent(r);
    setEndpoints(e);
    setActivity(a);
    setLoaded(true);
  }, []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useLive((ev) => {
    if (ev.type === "request") {
      setRecent((r) => [ev.request, ...r].slice(0, 12));
      setStats((s) => (s ? { ...s, requests: s.requests + 1 } : s));
    } else if (ev.type === "delivery") {
      setRecent((r) => r.map((x) => (x.id === ev.request_id ? { ...x, delivery: ev.delivery } : x)));
      if (ev.delivery.status === "delivered" || ev.delivery.status === "failed") load().catch(() => {});
    } else if (ev.type === "tunnel") {
      load().catch(() => {});
    }
  });

  const nameOf = (id: string) => endpoints.find((e) => e.id === id)?.name ?? "endpoint";

  return (
    <>
      <PageTitle title="Overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
        <Stat i={0} label="Endpoints" value={stats?.endpoints ?? "–"} />
        <Stat i={1} label="Requests" value={stats?.requests ?? "–"} />
        <Stat i={2} label="Delivered" value={stats?.delivered ?? "–"} tone="text-emerald-300" />
        <Stat i={3} label="Failed" value={stats?.failed ?? "–"} tone={stats && stats.failed > 0 ? "text-red-300" : "text-white"} />
        <Stat i={4} label="Active tunnels" value={tunnels} tone={tunnels > 0 ? "text-brand" : "text-white"} />
      </div>

      <h2 className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Last 24 hours</h2>
      <Card className="rise p-4" ><ActivityChart points={activity} /></Card>

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500"><span className="live-dot" /> Recent events</h2>
      <Card>
        {!loaded ? (
          <div className="p-8 text-center text-sm text-slate-600">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            {endpoints.length === 0 ? (
              <>
                No endpoints yet. <Link href="/endpoints/" className="text-brand hover:underline">Create your first endpoint</Link> to start capturing webhooks.
              </>
            ) : (
              <>Waiting for your first webhook. Send one to any of your endpoint URLs.</>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {recent.map((r) => (
              <li key={r.id} className="row-in">
                <Link href={`/endpoint/?id=${r.endpoint_id}&req=${r.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.04]">
                  <MethodBadge method={r.method} />
                  <span className="min-w-0 flex-1 truncate font-mono text-slate-200">{r.path}</span>
                  <span className="hidden text-xs text-slate-500 sm:inline">{nameOf(r.endpoint_id)}</span>
                  <span className="hidden text-xs text-slate-500 md:inline">{formatBytes(r.size)}</span>
                  <DeliveryBadge d={r.delivery} />
                  <span className="w-16 text-right text-xs text-slate-500">{timeAgo(r.received_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Overview />
    </Shell>
  );
}
