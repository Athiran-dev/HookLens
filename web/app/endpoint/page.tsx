"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { JsonView } from "@/components/fx";
import { Button, Card, CopyButton, DeliveryBadge, ErrorNote, Input, MethodBadge, Spinner } from "@/components/ui";
import {
  api,
  formatBytes,
  timeAgo,
  useLive,
  type BodyView,
  type Delivery,
  type Endpoint,
  type RequestDetail,
  type RequestSummary,
} from "@/lib/api";

const TABS = ["Overview", "Headers", "Payload", "Query Params", "Response", "Timeline"] as const;
type Tab = (typeof TABS)[number];

function prettyBody(b: BodyView, pretty: boolean): { text: string; isJson: boolean; binary: boolean } {
  if (b.body_text === null) return { text: `(binary data, ${atob(b.body_base64).length} bytes)\nbase64:\n${b.body_base64}`, isJson: false, binary: true };
  if (pretty) {
    try {
      return { text: JSON.stringify(JSON.parse(b.body_text), null, 2), isJson: true, binary: false };
    } catch {
      /* not JSON */
    }
  }
  return { text: b.body_text, isJson: false, binary: false };
}

function HeaderTable({ headers }: { headers: Record<string, string[]> | null }) {
  const rows = Object.entries(headers ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (rows.length === 0) return <p className="text-sm text-slate-500">No headers.</p>;
  return (
    <table className="w-full text-left text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-ink-700 align-top last:border-0">
            <td className="w-1/3 py-1.5 pr-4 font-mono text-xs text-slate-400">{k}</td>
            <td className="break-all py-1.5 font-mono text-xs text-slate-200">{v.join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Code({ children }: { children: string }) {
  return <JsonView text={children} />;
}

function Detail({ req, onReplay, replaying, replayError }: { req: RequestDetail; onReplay: () => void; replaying: boolean; replayError: string }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [pretty, setPretty] = useState(true);
  const body = prettyBody(req.body, pretty);
  const latest: Delivery | undefined = req.deliveries[0];
  const queryRows = useMemo(() => [...new URLSearchParams(req.query).entries()], [req.query]);
  const timeline = useMemo(
    () =>
      [
        { at: req.received_at, title: "Received & stored", detail: `${req.method} ${req.path} · ${formatBytes(req.size)} from ${req.source_ip || "unknown"}`, tone: "text-sky-300" },
        ...[...req.deliveries].reverse().map((d) => ({
          at: d.completed_at ?? d.created_at,
          title: `${d.kind === "replay" ? "Replay" : "Forward"} ${d.status === "no_tunnel" ? "skipped (no tunnel)" : d.status}`,
          detail: d.error || (d.response_code ? `HTTP ${d.response_code} in ${d.duration_ms ?? 0}ms${d.destination ? ` from ${d.destination}` : ""}` : "waiting for the local server…"),
          tone: d.status === "delivered" ? "text-emerald-300" : d.status === "failed" ? "text-red-300" : "text-slate-300",
        })),
      ],
    [req],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MethodBadge method={req.method} />
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-white">{req.path}{req.query ? `?${req.query}` : ""}</span>
        <Button variant="outline" onClick={onReplay} disabled={replaying} className="!py-1.5">
          {replaying ? <Spinner /> : "↻"} Replay request
        </Button>
      </div>
      {replayError && <div className="mb-3"><ErrorNote>{replayError}</ErrorNote></div>}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ink-700">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t ? "border-brand text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">Received</dt><dd>{new Date(req.received_at).toLocaleString()}</dd>
          <dt className="text-slate-500">Method</dt><dd className="font-mono">{req.method}</dd>
          <dt className="text-slate-500">Path</dt><dd className="break-all font-mono">{req.path}</dd>
          <dt className="text-slate-500">Content-Type</dt><dd className="font-mono">{req.content_type || "–"}</dd>
          <dt className="text-slate-500">Payload size</dt><dd>{formatBytes(req.size)}</dd>
          <dt className="text-slate-500">Source IP</dt><dd className="font-mono">{req.source_ip || "–"}</dd>
          <dt className="text-slate-500">Status</dt>
          <dd className="space-x-2">
            <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[11px] text-sky-300">received</span>
            <DeliveryBadge d={latest ? { id: latest.id, kind: latest.kind, status: latest.status, response_code: latest.response_code, duration_ms: latest.duration_ms } : null} />
          </dd>
          <dt className="text-slate-500">Request ID</dt><dd className="break-all font-mono text-xs">{req.id}</dd>
        </dl>
      )}

      {tab === "Headers" && (
        <>
          <HeaderTable headers={req.headers} />
          <p className="mt-3 text-xs text-slate-500">Authorization, Cookie and API-key headers are masked here. Replays still send the originals.</p>
        </>
      )}

      {tab === "Payload" && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <Button variant="outline" className="!px-2.5 !py-1 text-xs" onClick={() => setPretty((p) => !p)}>{pretty ? "Show raw" : "Pretty-print JSON"}</Button>
            {req.body.body_text !== null && <CopyButton text={req.body.body_text} label="Copy raw body" />}
            <span className="text-xs text-slate-500">{formatBytes(req.size)} · exact bytes are stored for signature checks</span>
          </div>
          {req.size === 0 ? <p className="text-sm text-slate-500">Empty body.</p> : <Code>{body.text}</Code>}
        </>
      )}

      {tab === "Query Params" &&
        (queryRows.length === 0 ? (
          <p className="text-sm text-slate-500">No query parameters.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody>
              {queryRows.map(([k, v], i) => (
                <tr key={i} className="border-b border-ink-700 last:border-0">
                  <td className="w-1/3 py-1.5 font-mono text-xs text-slate-400">{k}</td>
                  <td className="break-all py-1.5 font-mono text-xs">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

      {tab === "Response" &&
        (!latest ? (
          <p className="text-sm text-slate-500">This request has not been forwarded. Start the CLI, then replay it.</p>
        ) : latest.status === "no_tunnel" || latest.status === "pending" ? (
          <p className="text-sm text-slate-400">{latest.status === "pending" ? "Waiting for your local server…" : latest.error}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <DeliveryBadge d={{ id: latest.id, kind: latest.kind, status: latest.status, response_code: latest.response_code, duration_ms: latest.duration_ms }} />
              {latest.duration_ms !== null && <span className="text-slate-400">{latest.duration_ms} ms</span>}
              {latest.destination && <span className="font-mono text-xs text-slate-500">{latest.destination}</span>}
            </div>
            {latest.error && <ErrorNote>{latest.error}</ErrorNote>}
            <HeaderTable headers={latest.response_headers} />
            {latest.response_body.body_base64 && <Code>{prettyBody(latest.response_body, true).text}</Code>}
          </div>
        ))}

      {tab === "Timeline" && (
        <ol className="space-y-3 border-l border-ink-600 pl-4">
          {timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ink-600" />
              <div className={`text-sm font-medium ${t.tone}`}>{t.title}</div>
              <div className="text-xs text-slate-400">{t.detail}</div>
              <div className="text-[11px] text-slate-600">{new Date(t.at).toLocaleTimeString()}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function rail(r: RequestSummary): string {
  switch (r.delivery?.status) {
    case "delivered": return "border-emerald-400/70";
    case "failed": return "border-red-400/80";
    case "pending": return "border-amber-300/80";
    default: return "border-transparent";
  }
}

function Inspector() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [list, setList] = useState<RequestSummary[] | null>(null);
  const [selected, setSelected] = useState<string>(params.get("req") ?? "");
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const freshIds = useRef(new Set<string>());
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const filtersActive = q !== "" || method !== "" || status !== "";

  const loadEndpoint = useCallback(async () => {
    try {
      setEndpoint(await api<Endpoint>("GET", `/api/v1/endpoints/${id}`));
    } catch {
      setNotFound(true);
    }
  }, [id]);

  const loadList = useCallback(async () => {
    const qs = new URLSearchParams({ limit: "100" });
    if (q) qs.set("q", q);
    if (method) qs.set("method", method);
    if (status) qs.set("status", status);
    const rows = await api<RequestSummary[]>("GET", `/api/v1/endpoints/${id}/requests?${qs}`);
    setList(rows);
    if (!selectedRef.current && rows.length > 0) setSelected(rows[0].id);
  }, [id, q, method, status]);

  const loadDetail = useCallback(async (rid: string) => {
    if (!rid) return setDetail(null);
    try {
      setDetail(await api<RequestDetail>("GET", `/api/v1/requests/${rid}`));
    } catch {
      setDetail(null);
    }
  }, []);

  useEffect(() => {
    if (id) loadEndpoint();
  }, [id, loadEndpoint]);
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => loadList().catch(() => setList([])), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [id, loadList, q]);
  useEffect(() => {
    loadDetail(selected);
  }, [selected, loadDetail]);

  const connected = useLive((ev) => {
    if (ev.type === "tunnel" && ev.endpoint_id === id) setEndpoint((e) => (e ? { ...e, tunnel_connected: ev.connected } : e));
    if (ev.type === "request" && ev.request.endpoint_id === id) {
      setEndpoint((e) => (e ? { ...e, request_count: e.request_count + 1 } : e));
      if (!filtersActive) {
        freshIds.current.add(ev.request.id);
        setList((l) => [ev.request, ...(l ?? [])].slice(0, 100));
      }
    }
    if (ev.type === "delivery" && ev.endpoint_id === id) {
      setList((l) => l?.map((r) => (r.id === ev.request_id ? { ...r, delivery: ev.delivery } : r)) ?? l);
      if (ev.request_id === selectedRef.current) loadDetail(ev.request_id);
    }
  });

  const listRef = useRef(list);
  listRef.current = list;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
      const rows = listRef.current ?? [];
      const i = rows.findIndex((r) => r.id === selectedRef.current);
      if (e.key === "j" && i < rows.length - 1) setSelected(rows[i + 1].id);
      if (e.key === "k" && i > 0) setSelected(rows[i - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function replay() {
    if (!detail) return;
    if (!window.confirm("Replaying re-sends this exact payload to your local server. If your handler is not idempotent it may repeat side effects (double charges, duplicate emails). Replay anyway?")) return;
    setReplaying(true);
    setReplayError("");
    try {
      await api("POST", `/api/v1/requests/${detail.id}/replay`, {});
      await loadDetail(detail.id);
    } catch (e) {
      setReplayError(e instanceof Error ? e.message : "Replay failed");
      await loadDetail(detail.id);
    } finally {
      setReplaying(false);
    }
  }

  async function toggleStatus() {
    if (!endpoint) return;
    setEndpoint(await api<Endpoint>("PATCH", `/api/v1/endpoints/${id}`, { status: endpoint.status === "active" ? "inactive" : "active" }));
  }
  async function remove() {
    if (!window.confirm("Delete this endpoint and all its captured requests? The URL will stop working.")) return;
    await api("DELETE", `/api/v1/endpoints/${id}`);
    window.location.href = "/endpoints/";
  }

  if (notFound) return <Card className="p-8 text-center text-sm text-slate-400">Endpoint not found. <Link className="text-brand" href="/endpoints/">Back to endpoints</Link></Card>;
  if (!endpoint) return <div className="flex justify-center py-20"><Spinner /></div>;

  const curl = `curl -X POST ${endpoint.hook_url} \\\n  -H "Content-Type: application/json" \\\n  -d '{"event":"test","amount":500}'`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/endpoints/" className="text-sm text-slate-500 hover:text-slate-300">Endpoints /</Link>
        <h1 className="font-display text-2xl font-semibold text-white">{endpoint.name}</h1>
        <span className={`inline-flex items-center gap-1.5 text-xs ${endpoint.tunnel_connected ? "text-brand" : "text-slate-500"}`}>
          {endpoint.tunnel_connected ? <span className="live-dot" /> : <span className="h-2 w-2 rounded-full bg-slate-600" />}
          {endpoint.tunnel_connected ? "tunnel connected" : "no tunnel"}
        </span>
        {!connected && <span className="text-xs text-amber-400">live updates reconnecting…</span>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" className="!py-1 text-xs" onClick={toggleStatus}>{endpoint.status === "active" ? "Disable" : "Enable"}</Button>
          <Button variant="danger" className="!py-1 text-xs" onClick={remove}>Delete</Button>
        </div>
      </div>

      <Card className="mb-4 p-3">
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-xs text-slate-200">{endpoint.hook_url}</code>
          <CopyButton text={endpoint.hook_url} />
        </div>
        {!endpoint.tunnel_connected && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            Forward to localhost: <code className="rounded bg-ink-900 px-1.5 py-0.5 text-slate-300">hooklens listen 3000 --endpoint &quot;{endpoint.name}&quot;</code>
            <CopyButton text={`hooklens listen 3000 --endpoint "${endpoint.name}"`} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden">
          <div className="space-y-2 border-b border-ink-700 p-3">
            <Input placeholder="Search path, headers, body…  (j / k to move)" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex gap-2">
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200">
                <option value="">All methods</option>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m}>{m}</option>)}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200">
                <option value="">All results</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
                <option value="no_tunnel">Not forwarded</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          <ul className="max-h-[32rem] divide-y divide-white/5 overflow-y-auto">
            {list === null && <li className="p-6 text-center"><Spinner /></li>}
            {list?.length === 0 && (
              <li className="p-6 text-center text-sm text-slate-500">
                {filtersActive ? "No requests match these filters." : "No requests yet. Send one with the curl command below."}
              </li>
            )}
            {list?.map((r) => (
              <li key={r.id} className={freshIds.current.has(r.id) ? "row-in" : ""}>
                <button onClick={() => { setSelected(r.id); setReplayError(""); }} className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition hover:bg-white/[0.04] ${rail(r)} ${selected === r.id ? "bg-white/[0.07]" : ""}`}>
                  <MethodBadge method={r.method} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-200">{r.path}</span>
                  <DeliveryBadge d={r.delivery} />
                  <span className="w-14 text-right text-[11px] text-slate-500">{timeAgo(r.received_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="min-h-[20rem] min-w-0 p-4">
          {detail ? (
            <Detail req={detail} onReplay={replay} replaying={replaying} replayError={replayError} />
          ) : (
            <div className="space-y-3 py-10 text-center text-sm text-slate-400">
              <p>Select a request to inspect it, or send a test webhook:</p>
              <pre className="mx-auto max-w-xl overflow-x-auto rounded-md bg-ink-950 p-3 text-left text-xs text-slate-300">{curl}</pre>
              <CopyButton text={curl} label="Copy curl" />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
        <Inspector />
      </Suspense>
    </Shell>
  );
}
