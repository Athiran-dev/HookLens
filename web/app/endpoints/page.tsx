"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Shell, { useMeContext } from "@/components/Shell";
import { Button, Card, CopyButton, ErrorNote, Input, PageTitle } from "@/components/ui";
import { api, timeAgo, useLive, type Endpoint } from "@/lib/api";

function List() {
  const { me } = useMeContext();
  const [eps, setEps] = useState<Endpoint[] | null>(null);
  const [name, setName] = useState("");
  const [forward, setForward] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setEps(await api<Endpoint[]>("GET", "/api/v1/endpoints")), []);
  useEffect(() => {
    load().catch(() => setEps([]));
  }, [load]);
  useLive((ev) => {
    if (ev.type === "tunnel") setEps((l) => l?.map((e) => (e.id === ev.endpoint_id ? { ...e, tunnel_connected: ev.connected } : e)) ?? l);
    if (ev.type === "request") setEps((l) => l?.map((e) => (e.id === ev.request.endpoint_id ? { ...e, request_count: e.request_count + 1, last_request_at: ev.request.received_at } : e)) ?? l);
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("POST", "/api/v1/endpoints", { name, forward_url: forward });
      setName("");
      setForward("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create endpoint");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle title="Endpoints" />
      <Card className="mb-6 p-4">
        <form onSubmit={create} className="grid gap-3 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Name</label>
            <Input required maxLength={60} placeholder="Razorpay Testing" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Default local URL (optional)</label>
            <Input placeholder="http://localhost:3000/api/webhooks/razorpay" value={forward} onChange={(e) => setForward(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy}>Create endpoint</Button>
        </form>
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
        <p className="mt-3 text-xs text-slate-500">
          Capturing works even when no tunnel is running. {eps ? `${eps.length} of ${me.limits.max_endpoints} endpoints used.` : ""}
        </p>
      </Card>

      {eps === null ? null : eps.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">Create an endpoint above to get your public webhook URL.</Card>
      ) : (
        <div className="space-y-3">
          {eps.map((e) => (
            <Card key={e.id} className="rise p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/15">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/endpoint/?id=${e.id}`} className="font-display text-lg font-semibold text-white hover:text-brand">{e.name}</Link>
                {e.status === "inactive" && <span className="rounded bg-slate-500/20 px-1.5 py-0.5 text-xs text-slate-300">disabled</span>}
                <span className={`inline-flex items-center gap-1.5 text-xs ${e.tunnel_connected ? "text-emerald-400" : "text-slate-500"}`}>
                  {e.tunnel_connected ? <span className="live-dot" /> : <span className="h-2 w-2 rounded-full bg-slate-600" />}
                  {e.tunnel_connected ? "tunnel connected" : "no tunnel"}
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  {e.request_count} requests · last {timeAgo(e.last_request_at)}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-black/40 px-3 py-1.5 font-mono text-xs text-slate-300">{e.hook_url}</code>
                <CopyButton text={e.hook_url} />
                <Link href={`/endpoint/?id=${e.id}`}><Button variant="outline" className="!px-2.5 !py-1 text-xs">Inspect</Button></Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <List />
    </Shell>
  );
}
