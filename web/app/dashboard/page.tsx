"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Button, MethodBadge } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  CopyIconButton, EmptyState, LinkAction, Panel, PageHeader, Pill, Segmented, StatusDot, TableWrap, TerminalBlock, Td, Th, tbl,
} from "@/components/app";
import { TrafficChart } from "@/components/charts";
import { IconArrowDown, IconArrowUp, IconBolt, IconCheck, IconCode, IconList, IconPlus, IconTerminal } from "@/components/icons";
import {
  api, compact, duration, timeAgo, trend, useLive,
  type ActivityPoint, type ActivityRange, type RequestSummary, type StatsResponse, type TunnelInfo,
} from "@/lib/api";

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function Metric({ icon, label, value, sub, delta, goodWhenUp = true }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; delta?: { pct: number; up: boolean } | null; goodWhenUp?: boolean;
}) {
  const good = delta ? delta.up === goodWhenUp : true;
  return (
    <div className="flex items-start gap-3.5 px-5 py-4">
      <span className="mt-0.5 text-zinc-500">{icon}</span>
      <div className="min-w-0">
        <div className="text-[13px] text-zinc-400">{label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-[28px] font-semibold leading-none tabular-nums text-white">{value}</span>
          {delta && delta.pct > 0 && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? "text-emerald-400" : "text-red-400"}`}>
              {delta.up ? <IconArrowUp /> : <IconArrowDown />}{delta.pct}%
            </span>
          )}
        </div>
        {sub && <div className="mt-1 text-[11px] text-zinc-600">{sub}</div>}
      </div>
    </div>
  );
}

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${done ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-zinc-400"}`}>
        {done ? <IconCheck className="h-3.5 w-3.5" /> : n}
      </span>
      <div className="min-w-0 flex-1 pb-7">
        <div className={`text-[15px] font-semibold ${done ? "text-zinc-400" : "text-zinc-100"}`}>{title}</div>
        <div className="mt-2.5">{children}</div>
      </div>
    </li>
  );
}

function Overview() {
  const { me, endpoints } = useApp();
  const toast = useToast();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [recent, setRecent] = useState<RequestSummary[]>([]);
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([]);
  const [range, setRange] = useState<ActivityRange>("24h");
  const [points, setPoints] = useState<ActivityPoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  useTick(30000);

  const loadCore = useCallback(async () => {
    const [s, r, t] = await Promise.all([
      api<StatsResponse>("GET", "/api/v1/stats"),
      api<RequestSummary[]>("GET", "/api/v1/requests?limit=8"),
      api<TunnelInfo[]>("GET", "/api/v1/tunnels"),
    ]);
    setStats(s);
    setRecent(r);
    setTunnels(t);
    setLoaded(true);
  }, []);
  const loadActivity = useCallback(async (rg: ActivityRange) => {
    setPoints(await api<ActivityPoint[]>("GET", `/api/v1/stats/activity?range=${rg}`).catch(() => []));
  }, []);

  useEffect(() => {
    loadCore().catch(() => setLoaded(true));
  }, [loadCore]);
  useEffect(() => {
    loadActivity(range);
  }, [range, loadActivity]);

  const refreshSoon = useCallback(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      loadCore().catch(() => {});
      loadActivity(range);
    }, 600);
  }, [loadCore, loadActivity, range]);

  useLive((ev) => {
    if (ev.type === "request") setRecent((r) => [ev.request, ...r].slice(0, 8));
    if (ev.type === "delivery") setRecent((r) => r.map((x) => (x.id === ev.request_id ? { ...x, delivery: ev.delivery } : x)));
    refreshSoon();
  });

  const name = (id: string) => endpoints?.find((e) => e.id === id)?.name ?? "endpoint";
  const win = stats?.window;
  const total = stats?.stats.requests ?? 0;
  const first = endpoints?.[0];
  const connected = tunnels.length > 0;
  const curl = first ? `curl -X POST ${first.hook_url} \\\n  -H "Content-Type: application/json" \\\n  -d '{"event":"test","amount":500}'` : "";

  if (!loaded || endpoints === null) {
    return (
      <>
        <PageHeader crumbs={["Dashboard", "Overview"]} title="Overview" subtitle="Monitor your webhook traffic, endpoints and local tunnels." />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />
          <div className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />
        </div>
      </>
    );
  }

  const noEndpoints = endpoints.length === 0;
  const onboarding = total === 0;

  return (
    <>
      <PageHeader crumbs={["Dashboard", "Overview"]} title="Overview" subtitle="Monitor your webhook traffic, endpoints and local tunnels.">
        <Link href="/endpoints/?new=1"><Button><IconPlus /> Create endpoint</Button></Link>
        <Link href="/tunnels/"><Button variant="outline"><IconBolt /> Connect tunnel</Button></Link>
      </PageHeader>

      {onboarding && (
        <Panel className="mb-5" title="Get started with HookLens" action={<span className="text-xs text-zinc-500">3 steps · about 2 minutes</span>}>
          <ol className="mt-3">
            <Step n={1} done={!noEndpoints} title="Create your first endpoint">
              {noEndpoints ? (
                <>
                  <p className="mb-3 max-w-xl text-sm text-zinc-400">An endpoint is a public URL that captures every webhook sent to it, even when your computer is offline.</p>
                  <Link href="/endpoints/?new=1"><Button><IconPlus /> Create endpoint</Button></Link>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span className="font-medium text-zinc-300">{first?.name}</span>
                  <code className="truncate rounded bg-black/30 px-2 py-0.5 font-mono text-xs">{first?.hook_url}</code>
                  {first && <CopyIconButton text={first.hook_url} />}
                </div>
              )}
            </Step>
            <Step n={2} done={connected} title="Connect your local server with the CLI">
              <p className="mb-3 max-w-xl text-sm text-zinc-400">Optional but recommended: forward webhooks to the app running on your machine. The CLI connects outbound, so no port forwarding.</p>
              <TerminalBlock copy={"hooklens login\nhooklens listen 3000"}>{`$ hooklens login\n$ hooklens listen 3000`}</TerminalBlock>
            </Step>
            <Step n={3} done={false} title="Send a test webhook">
              {first ? (
                <>
                  <p className="mb-3 text-sm text-zinc-400">The quickest way: let HookLens send a sample webhook to your endpoint.</p>
                  <Button onClick={async () => { try { await api("POST", `/api/v1/endpoints/${first.id}/test`, {}); toast("Test webhook sent"); } catch (e) { toast(e instanceof Error ? e.message : "Could not send", "error"); } }}>Send test webhook</Button>
                  <details className="mt-4 text-sm text-zinc-500"><summary className="cursor-pointer hover:text-zinc-300">Or send one yourself from a terminal</summary><div className="mt-3"><TerminalBlock copy={curl} title="curl">{curl}</TerminalBlock></div></details>
                </>
              ) : (
                <p className="text-sm text-zinc-500">Create an endpoint first, then send any HTTP request to its URL.</p>
              )}
              <p className="mt-3 flex items-center gap-2 text-xs text-zinc-600"><span className="live-dot" /> Waiting for your first request. This page updates the moment it arrives.</p>
            </Step>
          </ol>
        </Panel>
      )}

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel flush className="self-start">
          <div className="grid grid-cols-2 divide-white/[0.07] sm:grid-cols-3 sm:divide-x xl:grid-cols-5 [&>*]:border-b [&>*]:border-white/[0.07] sm:[&>*]:border-b-0">
            <Metric icon={<IconCode />} label="Total endpoints" value={stats?.stats.endpoints ?? 0} sub={`of ${me.limits.max_endpoints} on your plan`} />
            <Metric icon={<IconList />} label="Requests (24h)" value={compact(win?.requests ?? 0)} delta={win ? trend(win.requests, win.prev_requests) : null} sub="vs previous 24h" />
            <Metric icon={<IconCheck />} label="Delivered (24h)" value={compact(win?.delivered ?? 0)} delta={win ? trend(win.delivered, win.prev_delivered) : null} sub="to your local server" />
            <Metric icon={<span className="text-red-400">✕</span>} label="Failed (24h)" value={<span className={win && win.failed > 0 ? "text-red-300" : ""}>{compact(win?.failed ?? 0)}</span>} delta={win ? trend(win.failed, win.prev_failed) : null} goodWhenUp={false} sub="4xx, 5xx or unreachable" />
            <Metric icon={<IconBolt />} label="Active tunnels" value={<span className="flex items-center gap-2">{tunnels.length}{connected && <span className="live-dot" />}</span>} sub={connected ? "connected now" : "none connected"} />
          </div>
        </Panel>

        <Panel title={connected ? "Tunnel active" : "No tunnel connected"} icon={<IconBolt />} className="xl:row-span-1">
          {connected ? (
            <div className="space-y-3 text-sm">
              {tunnels.slice(0, 1).map((t) => {
                const ep = endpoints.find((e) => e.id === t.endpoint_id);
                return (
                  <div key={t.tunnel_id} className="space-y-2.5">
                    <Row k="Endpoint" v={ep?.name ?? "—"} />
                    <Row k="Local destination" v={<span className="font-mono">{t.target || "—"}</span>} />
                    <Row k="Connected for" v={duration(t.connected_at)} />
                    {ep && <Row k="Public URL" v={<span className="flex items-center gap-1"><span className="max-w-[10rem] truncate font-mono text-xs">{ep.hook_url}</span><CopyIconButton text={ep.hook_url} /></span>} />}
                    <Button
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={async () => {
                        await api("DELETE", `/api/v1/tunnels/${t.endpoint_id}`).catch(() => {});
                        refreshSoon();
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                );
              })}
              {tunnels.length > 1 && <Link className="block text-xs text-brand" href="/tunnels/">+{tunnels.length - 1} more tunnels</Link>}
            </div>
          ) : (
            <div className="text-sm text-zinc-400">
              <p>Webhooks are still captured. Start the CLI to forward them to your machine.</p>
              <code className="mt-3 block rounded-md bg-black/40 px-3 py-2 font-mono text-xs text-zinc-200">hooklens listen 3000</code>
              <div className="mt-3"><LinkAction href="/tunnels/">Tunnel setup</LinkAction></div>
            </div>
          )}
        </Panel>
      </div>

      {!onboarding && (
        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Panel title="Traffic analytics" icon={<IconList />} action={<Segmented value={range} onChange={setRange} options={[{ value: "1h", label: "1h" }, { value: "24h", label: "24h" }, { value: "7d", label: "7d" }, { value: "30d", label: "30d" }]} />}>
            <TrafficChart points={points} range={range} />
          </Panel>
          <Panel title="Recent requests" icon={<IconList />} flush action={<span className="pr-5"><LinkAction href="/requests/">View all</LinkAction></span>}>
            <TableWrap>
              <table className={tbl}>
                <thead><tr className="border-b border-white/[0.06]"><Th>Method</Th><Th className="hidden 2xl:table-cell">Endpoint</Th><Th>Path</Th><Th>Status</Th><Th>Received</Th><Th className="text-right">Duration</Th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {recent.map((r) => (
                    <tr key={r.id} className="row-in cursor-pointer transition hover:bg-white/[0.03]" onClick={() => (window.location.href = `/endpoint/?id=${r.endpoint_id}&req=${r.id}`)}>
                      <Td><MethodBadge method={r.method} /></Td>
                      <Td className="hidden max-w-[9rem] truncate text-zinc-400 2xl:table-cell">{name(r.endpoint_id)}</Td>
                      <Td className="max-w-[12rem] truncate font-mono text-xs text-zinc-200">{r.path}</Td>
                      <Td><StatusDot delivery={r.delivery} /></Td>
                      <Td className="whitespace-nowrap text-zinc-500">{timeAgo(r.received_at)}</Td>
                      <Td className="text-right tabular-nums text-zinc-400">{r.delivery?.duration_ms != null ? `${r.delivery.duration_ms}ms` : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel title="Endpoints overview" icon={<IconCode />} flush action={<span className="pr-5"><LinkAction href="/endpoints/">View all endpoints</LinkAction></span>}>
          {endpoints.length === 0 ? (
            <EmptyState title="No endpoints yet" text="Create an endpoint to get a public URL for your webhooks.">
              <Link href="/endpoints/?new=1"><Button><IconPlus /> Create endpoint</Button></Link>
            </EmptyState>
          ) : (
            <TableWrap>
              <table className={tbl}>
                <thead><tr className="border-b border-white/[0.06]"><Th>Endpoint</Th><Th>Public URL</Th><Th>Requests</Th><Th>Last received</Th><Th>Status</Th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {endpoints.slice(0, 5).map((e) => (
                    <tr key={e.id} className="transition hover:bg-white/[0.03]">
                      <Td><Link href={`/endpoint/?id=${e.id}`} className="flex items-center gap-2.5 font-medium text-zinc-100 hover:text-brand"><i className={`h-2 w-2 rounded-full ${e.status === "active" ? "bg-brand" : "bg-zinc-600"}`} />{e.name}</Link></Td>
                      <Td><span className="flex items-center gap-1"><span className="max-w-[14rem] truncate font-mono text-xs text-zinc-400">{e.hook_url}</span><CopyIconButton text={e.hook_url} /></span></Td>
                      <Td className="tabular-nums">{compact(e.request_count)}</Td>
                      <Td className="whitespace-nowrap text-zinc-500">{timeAgo(e.last_request_at)}</Td>
                      <Td><Pill tone={e.status === "active" ? "green" : "gray"}>{e.status === "active" ? "Active" : "Disabled"}</Pill></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>

        <Panel title="Run the CLI" icon={<IconTerminal />} action={<LinkAction href="/docs/">View docs</LinkAction>}>
          <TerminalBlock copy={"hooklens login\nhooklens listen 3000"}>
            {`$ hooklens listen 3000\n`}<span className="text-emerald-400">✓</span>{` Authenticated\n`}<span className="text-emerald-400">✓</span>{` Tunnel connected\n`}<span className="text-emerald-400">✓</span>{` Forwarding requests to localhost:3000`}
          </TerminalBlock>
          <p className="mt-3 text-xs text-zinc-500">One command. Webhooks arrive on your machine and in this dashboard at the same time.</p>
        </Panel>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{k}</span>
      <span className="min-w-0 text-right text-zinc-200">{v}</span>
    </div>
  );
}

export default function Page() {
  return (
    <Shell>
      <Overview />
    </Shell>
  );
}
