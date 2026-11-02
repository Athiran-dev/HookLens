"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Button, Spinner } from "@/components/ui";
import { CopyIconButton, Modal, PageHeader, Panel, Pill, TerminalBlock } from "@/components/app";
import RequestsExplorer from "@/components/RequestsExplorer";
import { useToast } from "@/components/toast";
import { api, timeAgo } from "@/lib/api";

function Inspector() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { endpoints, reloadEndpoints } = useApp();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (endpoints === null) return <div className="flex justify-center py-24"><Spinner /></div>;
  const endpoint = endpoints.find((e) => e.id === id);
  if (!endpoint) {
    return (
      <Panel>
        <div className="py-10 text-center text-sm text-zinc-400">
          That endpoint doesn&apos;t exist (or was deleted). <Link className="text-brand hover:underline" href="/endpoints/">Back to endpoints</Link>
        </div>
      </Panel>
    );
  }

  const listenCmd = `hooklens listen 3000 --endpoint "${endpoint.name}"`;
  const curl = `curl -X POST ${endpoint.hook_url} \\\n  -H "Content-Type: application/json" \\\n  -d '{"event":"test","amount":500}'`;

  async function toggle() {
    await api("PATCH", `/api/v1/endpoints/${id}`, { status: endpoint!.status === "active" ? "inactive" : "active" });
    toast(endpoint!.status === "active" ? "Endpoint disabled" : "Endpoint enabled");
    reloadEndpoints();
  }
  async function remove() {
    await api("DELETE", `/api/v1/endpoints/${id}`);
    toast("Endpoint deleted");
    window.location.href = "/endpoints/";
  }

  return (
    <>
      <PageHeader crumbs={["Dashboard", "Endpoints", endpoint.name]} title={endpoint.name}>
        <Button variant="outline" onClick={toggle}>{endpoint.status === "active" ? "Disable" : "Enable"}</Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
      </PageHeader>

      <Panel className="mb-5" flush>
        <div className="grid gap-px bg-white/[0.06] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="bg-[#111113] p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              Public URL
              <Pill tone={endpoint.status === "active" ? "orange" : "gray"}>{endpoint.status === "active" ? "Active" : "Disabled"}</Pill>
              {endpoint.tunnel_connected ? <Pill tone="green">Tunnel connected</Pill> : <Pill tone="gray">No tunnel</Pill>}
              <span className="ml-auto">{endpoint.request_count} requests · last {timeAgo(endpoint.last_request_at)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 py-1 pl-3 pr-1">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-100">{endpoint.hook_url}</code>
              <CopyIconButton text={endpoint.hook_url} />
            </div>
            <p className="mt-3 text-xs text-zinc-600">Any method and path under this URL is captured, e.g. <span className="font-mono">/hook/…/api/webhooks/stripe</span>.</p>
          </div>
          <div className="bg-[#111113] p-5">
            <div className="mb-2 text-xs text-zinc-500">{endpoint.tunnel_connected ? "Send a test webhook" : "Forward to your local server"}</div>
            {endpoint.tunnel_connected ? <TerminalBlock copy={curl} title="curl">{curl}</TerminalBlock> : <TerminalBlock copy={listenCmd}>{`$ ${listenCmd}`}</TerminalBlock>}
          </div>
        </div>
      </Panel>

      <RequestsExplorer endpointId={id} initialReq={params.get("req") ?? ""} />

      {confirmDelete && (
        <Modal title="Delete endpoint?" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm leading-relaxed text-zinc-400"><b className="text-zinc-200">{endpoint.name}</b> and all of its captured requests will be permanently deleted. Its URL stops working immediately.</p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={remove}>Delete endpoint</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Suspense fallback={<div className="flex justify-center py-24"><Spinner /></div>}>
        <Inspector />
      </Suspense>
    </Shell>
  );
}
