"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Shell, { useApp } from "@/components/Shell";
import { Button, Input } from "@/components/ui";
import { EmptyState, Field, PageHeader, Panel, Pill, Select, TableWrap, TerminalBlock, Td, Th, tbl } from "@/components/app";
import { IconPlus } from "@/components/icons";
import { useToast } from "@/components/toast";
import { api, duration, useLive, type TunnelInfo } from "@/lib/api";

function Tunnels() {
  const { endpoints } = useApp();
  const toast = useToast();
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([]);
  const [, tick] = useState(0);
  const [port, setPort] = useState("3000");
  const [pick, setPick] = useState("");

  const load = useCallback(async () => setTunnels(await api<TunnelInfo[]>("GET", "/api/v1/tunnels").catch(() => [])), []);
  useEffect(() => {
    load();
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, [load]);
  useLive((ev) => {
    if (ev.type === "tunnel") setTimeout(load, 300);
  });

  const eps = endpoints ?? [];
  const chosen = eps.find((e) => e.id === pick) ?? eps[0];
  const portNum = port.trim() || "3000";
  const listen = chosen ? `hooklens listen ${portNum} --endpoint "${chosen.name}"` : `hooklens listen ${portNum}`;
  const byId = (id: string) => tunnels.find((t) => t.endpoint_id === id);

  return (
    <>
      <PageHeader crumbs={["Dashboard", "Tunnels"]} title="Tunnels" subtitle="Connections between your machine and HookLens. Webhooks are captured either way; a tunnel forwards them to localhost.">
        <Link href="/endpoints/?new=1"><Button variant="outline"><IconPlus /> New endpoint</Button></Link>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel title="Connections" flush>
          {eps.length === 0 ? (
            <EmptyState title="No endpoints yet" text="A tunnel attaches to an endpoint. Create one first, then connect the CLI.">
              <Link href="/endpoints/?new=1"><Button><IconPlus /> Create endpoint</Button></Link>
            </EmptyState>
          ) : (
            <TableWrap>
              <table className={tbl}>
                <thead><tr className="border-b border-white/[0.06]"><Th>Endpoint</Th><Th>State</Th><Th>Local destination</Th><Th>Uptime</Th><Th>In flight</Th><Th /></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {eps.map((e) => {
                    const t = byId(e.id);
                    return (
                      <tr key={e.id} className="transition hover:bg-white/[0.03]">
                        <Td><Link href={`/endpoint/?id=${e.id}`} className="font-medium text-zinc-100 hover:text-brand">{e.name}</Link></Td>
                        <Td>{t ? <span className="inline-flex items-center gap-2"><span className="live-dot" /><Pill tone="green">Connected</Pill></span> : <Pill tone="gray">Offline</Pill>}</Td>
                        <Td className="font-mono text-xs text-zinc-400">{t?.target || "—"}</Td>
                        <Td className="whitespace-nowrap text-zinc-400">{t ? duration(t.connected_at) : "—"}</Td>
                        <Td className="tabular-nums text-zinc-400">{t ? t.pending : "—"}</Td>
                        <Td className="text-right">
                          {t && (
                            <Button
                              variant="outline"
                              className="!px-2.5 !py-1 text-xs"
                              onClick={async () => {
                                await api("DELETE", `/api/v1/tunnels/${e.id}`).catch(() => {});
                                toast(`Disconnected ${e.name}`);
                                setTimeout(load, 400);
                              }}
                            >
                              Disconnect
                            </Button>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
          <div className="border-t border-white/[0.06] px-5 py-3.5 text-xs leading-relaxed text-zinc-600">
            Disconnecting stops the CLI for that endpoint. It will not reconnect on its own. Incoming webhooks keep being captured.
          </div>
        </Panel>

        <Panel title="Connect your local server">
          <ol className="space-y-5">
            <li>
              <div className="mb-2 text-[13px] font-medium text-zinc-300">1. Install the CLI</div>
              <TerminalBlock copy="go install github.com/Athiran-dev/HookLens/cmd/hooklens@latest">{`$ go install github.com/Athiran-dev/HookLens/cmd/hooklens@latest`}</TerminalBlock>
              <p className="mt-1.5 text-xs text-zinc-600">No Go? <a href="https://github.com/Athiran-dev/HookLens/releases/latest" target="_blank" rel="noreferrer" className="text-brand hover:underline">Download a ready-made binary</a> for Windows, macOS or Linux.</p>
            </li>
            <li>
              <div className="mb-2 text-[13px] font-medium text-zinc-300">2. Log in</div>
              <TerminalBlock copy="hooklens login">{`$ hooklens login`}</TerminalBlock>
            </li>
            <li>
              <div className="mb-2 text-[13px] font-medium text-zinc-300">3. Start forwarding</div>
              <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_7rem]">
                <Field label="Endpoint">
                  <Select value={chosen?.id ?? ""} onChange={setPick} className="w-full">
                    {eps.length === 0 && <option value="">(create an endpoint first)</option>}
                    {eps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </Select>
                </Field>
                <Field label="Local port"><Input value={port} onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="!h-9" /></Field>
              </div>
              <TerminalBlock copy={listen}>{`$ ${listen}`}</TerminalBlock>
            </li>
          </ol>
          <div className="mt-6 rounded-lg border border-white/[0.07] bg-black/20 p-4 text-xs leading-relaxed text-zinc-500">
            <div className="mb-1.5 font-semibold text-zinc-300">Not receiving requests locally?</div>
            Check that your app is listening on that port, and that you pasted the public URL into your provider. Failed forwards show the reason on the request&apos;s Response tab.
          </div>
        </Panel>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Tunnels />
    </Shell>
  );
}
