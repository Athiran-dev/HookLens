"use client";

import { useMemo, useState } from "react";
import { Button, ErrorNote, MethodBadge, Spinner } from "@/components/ui";
import { CopyIconButton, Modal, Pill, StatusDot } from "@/components/app";
import { JsonView } from "@/components/fx";
import { formatBytes, type BodyView, type Delivery, type RequestDetail as Detail } from "@/lib/api";

const TABS = ["Overview", "Headers", "Payload", "Query Params", "Response", "Timeline"] as const;
type Tab = (typeof TABS)[number];

function prettyBody(b: BodyView, pretty: boolean): string {
  if (b.body_text === null) return `(binary data, ${atob(b.body_base64).length} bytes)\nbase64:\n${b.body_base64}`;
  if (pretty) {
    try {
      return JSON.stringify(JSON.parse(b.body_text), null, 2);
    } catch {
      /* not JSON */
    }
  }
  return b.body_text;
}

function HeaderTable({ headers }: { headers: Record<string, string[]> | null }) {
  const rows = Object.entries(headers ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (rows.length === 0) return <p className="text-sm text-zinc-500">No headers.</p>;
  return (
    <table className="w-full text-left text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-white/[0.05] align-top last:border-0">
            <td className="w-[34%] py-2 pr-4 font-mono text-xs text-zinc-500">{k}</td>
            <td className="break-all py-2 font-mono text-xs text-zinc-200">{v.join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function deliveryBrief(d: Delivery) {
  return { id: d.id, kind: d.kind, status: d.status, response_code: d.response_code, duration_ms: d.duration_ms };
}

export default function RequestDetail({ req, onReplay, replaying, replayError }: { req: Detail; onReplay: () => void; replaying: boolean; replayError: string }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [pretty, setPretty] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const latest: Delivery | undefined = req.deliveries[0];
  const queryRows = useMemo(() => [...new URLSearchParams(req.query).entries()], [req.query]);
  const timeline = useMemo(
    () => [
      { at: req.received_at, title: "Received and stored", detail: `${req.method} ${req.path} · ${formatBytes(req.size)} from ${req.source_ip || "unknown"}`, tone: "text-sky-300" },
      ...[...req.deliveries].reverse().map((d) => ({
        at: d.completed_at ?? d.created_at,
        title: `${d.kind === "replay" ? "Replay" : "Forward"} ${d.status === "no_tunnel" ? "skipped (no tunnel)" : d.status}`,
        detail: d.error || (d.response_code ? `HTTP ${d.response_code} in ${d.duration_ms ?? 0}ms${d.destination ? ` from ${d.destination}` : ""}` : "waiting for the local server…"),
        tone: d.status === "delivered" ? "text-emerald-300" : d.status === "failed" ? "text-red-300" : "text-zinc-300",
      })),
    ],
    [req],
  );

  const fullPath = `${req.path}${req.query ? `?${req.query}` : ""}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MethodBadge method={req.method} />
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-white">{fullPath}</span>
        <CopyIconButton text={req.body.body_text ?? req.body.body_base64} label="Copy raw body" />
        <Button onClick={() => setConfirm(true)} disabled={replaying} className="!py-1.5">
          {replaying ? <Spinner /> : "↻"} Replay
        </Button>
      </div>
      {replayError && <div className="mb-3"><ErrorNote>{replayError}</ErrorNote></div>}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/[0.07]">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${tab === t ? "border-brand text-white" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <dl className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-y-3 text-sm">
          <dt className="text-zinc-500">Received</dt><dd className="text-zinc-200">{new Date(req.received_at).toLocaleString()}</dd>
          <dt className="text-zinc-500">Method</dt><dd className="font-mono text-zinc-200">{req.method}</dd>
          <dt className="text-zinc-500">Path</dt><dd className="break-all font-mono text-zinc-200">{req.path}</dd>
          <dt className="text-zinc-500">Content-Type</dt><dd className="font-mono text-zinc-200">{req.content_type || "—"}</dd>
          <dt className="text-zinc-500">Payload size</dt><dd className="text-zinc-200">{formatBytes(req.size)}</dd>
          <dt className="text-zinc-500">Source IP</dt><dd className="font-mono text-zinc-200">{req.source_ip || "—"}</dd>
          <dt className="text-zinc-500">Capture</dt><dd><Pill tone="gray">Received</Pill></dd>
          <dt className="text-zinc-500">Delivery</dt><dd><StatusDot delivery={latest ? deliveryBrief(latest) : null} />{latest?.kind === "replay" && <span className="ml-2 text-xs text-zinc-500">(replay)</span>}</dd>
          <dt className="text-zinc-500">Request ID</dt><dd className="flex items-center gap-1 break-all font-mono text-xs text-zinc-400">{req.id}<CopyIconButton text={req.id} /></dd>
        </dl>
      )}

      {tab === "Headers" && (
        <>
          <HeaderTable headers={req.headers} />
          <p className="mt-4 text-xs text-zinc-600">Authorization, Cookie and API-key headers are masked here. Replays still send the originals.</p>
        </>
      )}

      {tab === "Payload" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" className="!px-2.5 !py-1 text-xs" onClick={() => setPretty((p) => !p)}>{pretty ? "Show raw" : "Pretty-print JSON"}</Button>
            <span className="text-xs text-zinc-600">{formatBytes(req.size)} · exact bytes are stored for signature checks</span>
          </div>
          {req.size === 0 ? <p className="text-sm text-zinc-500">Empty body.</p> : <JsonView text={prettyBody(req.body, pretty)} />}
        </>
      )}

      {tab === "Query Params" &&
        (queryRows.length === 0 ? (
          <p className="text-sm text-zinc-500">No query parameters.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody>
              {queryRows.map(([k, v], i) => (
                <tr key={i} className="border-b border-white/[0.05] last:border-0">
                  <td className="w-[34%] py-2 font-mono text-xs text-zinc-500">{k}</td>
                  <td className="break-all py-2 font-mono text-xs text-zinc-200">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

      {tab === "Response" &&
        (!latest ? (
          <p className="text-sm text-zinc-500">This request has not been forwarded. Connect the CLI, then replay it.</p>
        ) : latest.status === "no_tunnel" || latest.status === "pending" ? (
          <p className="text-sm text-zinc-400">{latest.status === "pending" ? "Waiting for your local server…" : latest.error}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusDot delivery={deliveryBrief(latest)} />
              {latest.duration_ms !== null && <span className="text-zinc-500">{latest.duration_ms} ms</span>}
              {latest.destination && <span className="font-mono text-xs text-zinc-600">{latest.destination}</span>}
            </div>
            {latest.error && <ErrorNote>{latest.error}</ErrorNote>}
            <HeaderTable headers={latest.response_headers} />
            {latest.response_body.body_base64 && <JsonView text={prettyBody(latest.response_body, true)} />}
          </div>
        ))}

      {tab === "Timeline" && (
        <ol className="space-y-4 border-l border-white/10 pl-5">
          {timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-zinc-600" />
              <div className={`text-sm font-medium ${t.tone}`}>{t.title}</div>
              <div className="text-xs text-zinc-400">{t.detail}</div>
              <div className="text-[11px] text-zinc-600">{new Date(t.at).toLocaleTimeString()}</div>
            </li>
          ))}
        </ol>
      )}

      {confirm && (
        <Modal title="Replay this request?" onClose={() => setConfirm(false)}>
          <p className="text-sm leading-relaxed text-zinc-400">
            This re-sends the exact payload to your local server through the connected tunnel. If your handler is not idempotent it may repeat side effects such as double charges or duplicate emails.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button onClick={() => { setConfirm(false); onReplay(); }}>↻ Replay request</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
