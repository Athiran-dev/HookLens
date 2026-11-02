"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Button, ErrorNote, Input } from "@/components/ui";
import {
  CopyIconButton, EmptyState, Field, Modal, PageHeader, Panel, Pill, Select, TableWrap, TerminalBlock, Td, Th, tbl,
} from "@/components/app";
import { IconDots, IconPlus, IconSearch } from "@/components/icons";
import { useToast } from "@/components/toast";
import { api, compact, timeAgo, type Endpoint } from "@/lib/api";

function EndpointDialog({ edit, onClose }: { edit: Endpoint | null; onClose: () => void }) {
  const { reloadEndpoints, me, endpoints } = useApp();
  const toast = useToast();
  const [name, setName] = useState(edit?.name ?? "");
  const [forward, setForward] = useState(edit?.forward_url ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Endpoint | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (edit) {
        await api("PATCH", `/api/v1/endpoints/${edit.id}`, { name, forward_url: forward });
        toast("Endpoint updated");
        await reloadEndpoints();
        onClose();
      } else {
        const ep = await api<Endpoint>("POST", "/api/v1/endpoints", { name, forward_url: forward });
        await reloadEndpoints();
        setCreated(ep);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const cmd = `hooklens listen 3000 --endpoint "${created.name}"`;
    return (
      <Modal title="Endpoint created" onClose={onClose} width="max-w-lg">
        <p className="mb-4 text-sm text-zinc-400">Send webhooks to this URL. They are captured immediately, even when no tunnel is running.</p>
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 py-1 pl-3 pr-1">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200">{created.hook_url}</code>
          <CopyIconButton text={created.hook_url} />
        </div>
        <p className="mb-2 text-[13px] font-medium text-zinc-300">Forward to your local server</p>
        <TerminalBlock copy={cmd}>{`$ ${cmd}`}</TerminalBlock>
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose}>Done</Button>
          <Link href={`/endpoint/?id=${created.id}`}><Button>Open inspector →</Button></Link>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={edit ? "Edit endpoint" : "Create endpoint"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" hint="Something you will recognise, such as the provider or service.">
          <Input required autoFocus maxLength={60} placeholder="Razorpay Testing" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Default local URL (optional)" hint="Used by the CLI when you run hooklens listen without a port.">
          <Input placeholder="http://localhost:3000/api/webhooks/razorpay" value={forward} onChange={(e) => setForward(e.target.value)} />
        </Field>
        {!edit && <p className="text-xs text-zinc-600">{endpoints?.length ?? 0} of {me.limits.max_endpoints} endpoints used.</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2.5 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : edit ? "Save changes" : "Create endpoint"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function RowMenu({ e, onEdit, onToggle, onDelete }: { e: Endpoint; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex justify-end">
      <button onClick={() => setOpen((o) => !o)} className="rounded-md p-1.5 text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-100" aria-label={`Actions for ${e.name}`}><IconDots /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 w-44 rounded-xl border border-white/10 bg-[#18181b] p-1.5 shadow-2xl">
            <Link href={`/endpoint/?id=${e.id}`} className="block rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Inspect requests</Link>
            <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/5" onClick={() => { setOpen(false); onEdit(); }}>Edit</button>
            <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/5" onClick={() => { setOpen(false); onToggle(); }}>{e.status === "active" ? "Disable" : "Enable"}</button>
            <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10" onClick={() => { setOpen(false); onDelete(); }}>Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

function List() {
  const { endpoints, reloadEndpoints, me } = useApp();
  const toast = useToast();
  const params = useSearchParams();
  const [dialog, setDialog] = useState<"none" | "create" | Endpoint>("none");
  const [confirmDelete, setConfirmDelete] = useState<Endpoint | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (params.get("new") === "1") setDialog("create");
  }, [params]);

  const rows = useMemo(
    () => (endpoints ?? []).filter((e) => (!q || e.name.toLowerCase().includes(q.toLowerCase()) || e.hook_url.includes(q)) && (!status || e.status === status)),
    [endpoints, q, status],
  );

  async function toggle(e: Endpoint) {
    await api("PATCH", `/api/v1/endpoints/${e.id}`, { status: e.status === "active" ? "inactive" : "active" });
    toast(e.status === "active" ? `${e.name} disabled` : `${e.name} enabled`);
    reloadEndpoints();
  }
  async function remove(e: Endpoint) {
    await api("DELETE", `/api/v1/endpoints/${e.id}`);
    toast(`${e.name} deleted`);
    setConfirmDelete(null);
    reloadEndpoints();
  }

  const closeDialog = () => {
    setDialog("none");
    if (params.get("new")) window.history.replaceState(null, "", "/endpoints/");
  };

  return (
    <>
      <PageHeader crumbs={["Dashboard", "Endpoints"]} title="Endpoints" subtitle="Public URLs that capture webhooks. Each endpoint keeps its own request history.">
        <Button onClick={() => setDialog("create")}><IconPlus /> Create endpoint</Button>
      </PageHeader>

      <Panel flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
            <IconSearch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
            <Input placeholder="Filter endpoints…" value={q} onChange={(e) => setQ(e.target.value)} className="!h-9 !pl-9" />
          </div>
          <Select value={status} onChange={setStatus}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Disabled</option>
          </Select>
          <span className="ml-auto text-xs text-zinc-600">{endpoints?.length ?? 0} of {me.limits.max_endpoints} used</span>
        </div>

        {endpoints === null ? (
          <div className="p-10 text-center text-sm text-zinc-600">Loading…</div>
        ) : endpoints.length === 0 ? (
          <EmptyState title="Create your first endpoint" text="An endpoint gives you a public URL for webhooks. Point Stripe, Razorpay, GitHub or any HTTP sender at it, then inspect and replay every request.">
            <Button onClick={() => setDialog("create")}><IconPlus /> Create endpoint</Button>
            <Link href="/docs/"><Button variant="outline">Read the quickstart</Button></Link>
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState title="No matching endpoints" text="Try a different name or clear the filters." />
        ) : (
          <TableWrap>
            <table className={tbl + " min-w-[860px]"}>
              <thead>
                <tr className="border-b border-white/[0.06]"><Th>Name</Th><Th>Public URL</Th><Th>Local target</Th><Th>Requests</Th><Th>Last received</Th><Th>Tunnel</Th><Th>Status</Th><Th /></tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map((e) => (
                  <tr key={e.id} className="transition hover:bg-white/[0.03]">
                    <Td><Link href={`/endpoint/?id=${e.id}`} className="flex items-center gap-2.5 font-medium text-zinc-100 hover:text-brand"><i className={`h-2 w-2 shrink-0 rounded-full ${e.status === "active" ? "bg-brand" : "bg-zinc-600"}`} />{e.name}</Link></Td>
                    <Td><span className="flex items-center gap-1"><span className="max-w-[17rem] truncate font-mono text-xs text-zinc-400">{e.hook_url}</span><CopyIconButton text={e.hook_url} /></span></Td>
                    <Td className="max-w-[12rem] truncate font-mono text-xs text-zinc-500">{e.forward_url || "—"}</Td>
                    <Td className="tabular-nums">{compact(e.request_count)}</Td>
                    <Td className="whitespace-nowrap text-zinc-500">{timeAgo(e.last_request_at)}</Td>
                    <Td>{e.tunnel_connected ? <Pill tone="green">Connected</Pill> : <Pill tone="gray">Offline</Pill>}</Td>
                    <Td><Pill tone={e.status === "active" ? "orange" : "gray"}>{e.status === "active" ? "Active" : "Disabled"}</Pill></Td>
                    <Td className="w-12"><RowMenu e={e} onEdit={() => setDialog(e)} onToggle={() => toggle(e)} onDelete={() => setConfirmDelete(e)} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {dialog !== "none" && <EndpointDialog edit={dialog === "create" ? null : dialog} onClose={closeDialog} />}
      {confirmDelete && (
        <Modal title="Delete endpoint?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm leading-relaxed text-zinc-400">
            <b className="text-zinc-200">{confirmDelete.name}</b> and all of its captured requests will be permanently deleted. Its URL will stop working immediately.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => remove(confirmDelete)}>Delete endpoint</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Suspense>
        <List />
      </Suspense>
    </Shell>
  );
}
