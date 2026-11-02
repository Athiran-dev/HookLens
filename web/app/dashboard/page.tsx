"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Card, DeliveryBadge, MethodBadge, PageTitle } from "@/components/ui";
import { api, formatBytes, timeAgo, useLive, type Endpoint, type RequestSummary, type Stats } from "@/lib/api";

function Stat({ label, value, tone = "text-white" }: { label: string; value: number | string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </Card>
  );
}

function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tunnels, setTunnels] = useState(0);
  const [recent, setRecent] = useState<RequestSummary[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);

  const load = useCallback(async () => {
    const [s, r, e] = await Promise.all([
      api<{ stats: Stats; active_tunnels: number }>("GET", "/api/v1/stats"),
      api<RequestSummary[]>("GET", "/api/v1/requests?limit=12"),
      api<Endpoint[]>("GET", "/api/v1/endpoints"),
    ]);
    setStats(s.stats);
    setTunnels(s.active_tunnels);
    setRecent(r);
    setEndpoints(e);
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Endpoints" value={stats?.endpoints ?? "–"} />
        <Stat label="Requests" value={stats?.requests ?? "–"} />
        <Stat label="Delivered" value={stats?.delivered ?? "–"} tone="text-emerald-300" />
        <Stat label="Failed" value={stats?.failed ?? "–"} tone={stats && stats.failed > 0 ? "text-red-300" : "text-white"} />
        <Stat label="Active tunnels" value={tunnels} tone={tunnels > 0 ? "text-brand" : "text-white"} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent events</h2>
      <Card>
        {recent.length === 0 ? (
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
          <ul className="divide-y divide-ink-700">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/endpoint/?id=${r.endpoint_id}&req=${r.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-700/50">
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
