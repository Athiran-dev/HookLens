"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, MethodBadge, Spinner } from "@/components/ui";
import { EmptyState, Panel, Select, StatusDot } from "@/components/app";
import RequestDetailView from "@/components/RequestDetail";
import { useApp } from "@/components/Shell";
import { IconSearch } from "@/components/icons";
import { api, timeAgo, useLive, type RequestDetail, type RequestSummary } from "@/lib/api";

const PAGE = 50;

/**
 * Dense split-pane inspector: request list on the left, full detail on the right.
 * With endpointId it is scoped to one endpoint, otherwise it spans all of them.
 */
export default function RequestsExplorer({ endpointId, initialQuery = "", initialReq = "" }: { endpointId?: string; initialQuery?: string; initialReq?: string }) {
  const { endpoints } = useApp();
  const [list, setList] = useState<RequestSummary[] | null>(null);
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState(initialReq);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [q, setQ] = useState(initialQuery);
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [endpoint, setEndpoint] = useState(endpointId ?? "");
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState("");
  const fresh = useRef(new Set<string>());
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const filtersActive = q !== "" || method !== "" || status !== "" || (!endpointId && endpoint !== "");

  const query = useCallback(
    (before?: string) => {
      const qs = new URLSearchParams({ limit: String(PAGE) });
      if (q) qs.set("q", q);
      if (method) qs.set("method", method);
      if (status) qs.set("status", status);
      if (endpoint) qs.set("endpoint_id", endpoint);
      if (before) qs.set("before", before);
      return `/api/v1/requests?${qs}`;
    },
    [q, method, status, endpoint],
  );

  const load = useCallback(async () => {
    const rows = await api<RequestSummary[]>("GET", query());
    setList(rows);
    setMore(rows.length === PAGE);
    if (!selectedRef.current && rows.length > 0) setSelected(rows[0].id);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => load().catch(() => setList([])), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) return setDetail(null);
    try {
      setDetail(await api<RequestDetail>("GET", `/api/v1/requests/${id}`));
    } catch {
      setDetail(null);
    }
  }, []);
  useEffect(() => {
    loadDetail(selected);
  }, [selected, loadDetail]);

  const connected = useLive((ev) => {
    if (ev.type === "request" && (!endpointId || ev.request.endpoint_id === endpointId) && !filtersActive) {
      fresh.current.add(ev.request.id);
      setList((l) => [ev.request, ...(l ?? [])]);
    }
    if (ev.type === "delivery") {
      setList((l) => l?.map((r) => (r.id === ev.request_id ? { ...r, delivery: ev.delivery } : r)) ?? l);
      if (ev.request_id === selectedRef.current) loadDetail(ev.request_id);
    }
  });

  const listRef = useRef(list);
  listRef.current = list;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const rows = listRef.current ?? [];
      const i = rows.findIndex((r) => r.id === selectedRef.current);
      if (e.key === "j" && i < rows.length - 1) setSelected(rows[i + 1].id);
      if (e.key === "k" && i > 0) setSelected(rows[i - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function loadMore() {
    const last = list?.[list.length - 1];
    if (!last) return;
    const rows = await api<RequestSummary[]>("GET", query(last.received_at));
    setList((l) => [...(l ?? []), ...rows]);
    setMore(rows.length === PAGE);
  }

  async function replay() {
    if (!detail) return;
    setReplaying(true);
    setReplayError("");
    try {
      await api("POST", `/api/v1/requests/${detail.id}/replay`, {});
    } catch (e) {
      setReplayError(e instanceof Error ? e.message : "Replay failed");
    } finally {
      await loadDetail(detail.id);
      setReplaying(false);
    }
  }

  const nameOf = (id: string) => endpoints?.find((e) => e.id === id)?.name ?? "—";
  const rail = (r: RequestSummary) =>
    ({ delivered: "border-emerald-400/70", failed: "border-red-400/80", pending: "border-amber-300/80" } as Record<string, string>)[r.delivery?.status ?? ""] ?? "border-transparent";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Panel flush className="h-fit overflow-hidden">
        <div className="space-y-2.5 border-b border-white/[0.06] p-4">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-600" />
            <Input placeholder="Search path, headers, body…" value={q} onChange={(e) => setQ(e.target.value)} className="!pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            {!endpointId && (
              <Select value={endpoint} onChange={setEndpoint} className="min-w-0 flex-1">
                <option value="">All endpoints</option>
                {(endpoints ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            )}
            <Select value={method} onChange={setMethod} className="flex-1">
              <option value="">All methods</option>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m}>{m}</option>)}
            </Select>
            <Select value={status} onChange={setStatus} className="flex-1">
              <option value="">All results</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="no_tunnel">Not forwarded</option>
              <option value="pending">Pending</option>
            </Select>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-600">
            <span>{connected ? <span className="inline-flex items-center gap-1.5"><span className="live-dot" /> Live</span> : "Reconnecting…"}</span>
            <span>j / k to move</span>
          </div>
        </div>
        <ul className="max-h-[calc(100vh-22rem)] min-h-[16rem] divide-y divide-white/[0.05] overflow-y-auto">
          {list === null && <li className="p-8 text-center"><Spinner /></li>}
          {list?.length === 0 && (
            <li>
              <EmptyState
                title={filtersActive ? "No requests match" : "No requests yet"}
                text={filtersActive ? "Try clearing a filter." : "Send a webhook to one of your endpoint URLs and it appears here instantly."}
              >
                {!filtersActive && endpointId && (
                  <Button onClick={async () => { await api("POST", `/api/v1/endpoints/${endpointId}/test`, {}).catch(() => {}); }}>Send test webhook</Button>
                )}
              </EmptyState>
            </li>
          )}
          {list?.map((r) => (
            <li key={r.id} className={fresh.current.has(r.id) ? "row-in" : ""}>
              <button
                onClick={() => { setSelected(r.id); setReplayError(""); }}
                className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left text-sm transition hover:bg-white/[0.04] ${rail(r)} ${selected === r.id ? "bg-white/[0.06]" : ""}`}
              >
                <MethodBadge method={r.method} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[13px] text-zinc-100">{r.path}</span>
                  {!endpointId && <span className="block truncate text-[11px] text-zinc-600">{nameOf(r.endpoint_id)}</span>}
                </span>
                <span className="hidden text-xs sm:block"><StatusDot delivery={r.delivery} /></span>
                <span className="w-14 shrink-0 text-right text-[11px] text-zinc-600">{timeAgo(r.received_at)}</span>
              </button>
            </li>
          ))}
          {more && (
            <li className="p-3 text-center"><Button variant="ghost" className="!text-xs" onClick={loadMore}>Load older requests</Button></li>
          )}
        </ul>
      </Panel>

      <Panel className="min-h-[24rem] min-w-0 xl:sticky xl:top-24 xl:self-start">
        {detail ? (
          <RequestDetailView req={detail} onReplay={replay} replaying={replaying} replayError={replayError} />
        ) : (
          <EmptyState title="Select a request" text="Pick a request on the left to inspect its headers, exact payload, your local server's response and a full timeline." />
        )}
      </Panel>
    </div>
  );
}
