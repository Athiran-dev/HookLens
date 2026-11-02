"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { Button, MethodBadge } from "@/components/ui";
import { EmptyState, PageHeader, Panel, Pill, Select, TableWrap, Td, Th, tbl } from "@/components/app";
import { api, timeAgo, useLive, type DeliveryRow } from "@/lib/api";

function tone(s: DeliveryRow["status"]): "green" | "red" | "amber" | "gray" {
  return s === "delivered" ? "green" : s === "failed" ? "red" : s === "pending" ? "amber" : "gray";
}
const label = { delivered: "Delivered", failed: "Failed", pending: "Running", no_tunnel: "No tunnel" } as const;

function Replays() {
  const [rows, setRows] = useState<DeliveryRow[] | null>(null);
  const [status, setStatus] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async () => {
    setRows(await api<DeliveryRow[]>("GET", "/api/v1/deliveries?kind=replay&limit=100").catch(() => []));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useLive((ev) => {
    if (ev.type === "delivery" && ev.delivery.kind === "replay") {
      clearTimeout(debounce.current);
      debounce.current = setTimeout(load, 400);
    }
  });

  const shown = (rows ?? []).filter((r) => !status || r.status === status);

  return (
    <>
      <PageHeader crumbs={["Dashboard", "Replays"]} title="Replays" subtitle="Every time you re-sent a captured request to your local server, with the result.">
        <Link href="/requests/"><Button variant="outline">Open requests</Button></Link>
      </PageHeader>

      <Panel flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <Select value={status} onChange={setStatus}>
            <option value="">All results</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="no_tunnel">No tunnel</option>
          </Select>
          <span className="ml-auto text-xs text-zinc-600">{shown.length} replay{shown.length === 1 ? "" : "s"}</span>
        </div>
        {rows === null ? (
          <div className="p-10 text-center text-sm text-zinc-600">Loading…</div>
        ) : shown.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? "No replays yet" : "No matching replays"}
            text={rows.length === 0 ? "Open any captured request and press Replay. HookLens re-sends the original payload through your tunnel, so you can retest a fix without triggering the event again." : "Try a different result filter."}
          >
            {rows.length === 0 && <Link href="/requests/"><Button>Browse requests</Button></Link>}
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={tbl + " min-w-[820px]"}>
              <thead><tr className="border-b border-white/[0.06]"><Th>When</Th><Th>Request</Th><Th>Endpoint</Th><Th>Destination</Th><Th>Result</Th><Th className="text-right">Duration</Th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows && shown.map((r) => (
                  <tr key={r.id} className="transition hover:bg-white/[0.03]">
                    <Td className="whitespace-nowrap text-zinc-500">{timeAgo(r.created_at)}</Td>
                    <Td>
                      <Link href={`/endpoint/?id=${r.endpoint_id}&req=${r.request_id}`} className="flex items-center gap-2.5 hover:text-brand">
                        <MethodBadge method={r.method} /><span className="max-w-[16rem] truncate font-mono text-xs text-zinc-100">{r.path}</span>
                      </Link>
                    </Td>
                    <Td className="text-zinc-400">{r.endpoint_name}</Td>
                    <Td className="max-w-[12rem] truncate font-mono text-xs text-zinc-500">{r.destination || "—"}</Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <Pill tone={tone(r.status)}>{label[r.status]}</Pill>
                        {r.response_code && <span className="font-mono text-xs text-zinc-500">{r.response_code}</span>}
                      </span>
                      {r.error && r.status !== "delivered" && <div className="mt-1 max-w-[18rem] truncate text-[11px] text-zinc-600" title={r.error}>{r.error}</div>}
                    </Td>
                    <Td className="text-right tabular-nums text-zinc-400">{r.duration_ms != null ? `${r.duration_ms}ms` : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
      <p className="mt-4 text-xs text-zinc-600">Replays can repeat side effects such as charges or emails. Make your handlers idempotent, for example by de-duplicating on the provider&apos;s event ID.</p>
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Replays />
    </Shell>
  );
}
