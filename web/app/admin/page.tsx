"use client";

import { useCallback, useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Button } from "@/components/ui";
import { EmptyState, Modal, PageHeader, Panel, Pill, Select, TableWrap, Td, Th, tbl } from "@/components/app";
import { useToast } from "@/components/toast";
import { api, timeAgo } from "@/lib/api";

type Row = { id: string; email: string; category: "bug" | "idea" | "question" | "other"; message: string; page: string; created_at: string };

const tone = { bug: "red", idea: "orange", question: "amber", other: "gray" } as const;

function Feedback() {
  const { me } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("");
  const [del, setDel] = useState<Row | null>(null);

  const load = useCallback(async () => setRows(await api<Row[]>("GET", "/api/v1/admin/feedback?limit=200").catch(() => [])), []);
  useEffect(() => {
    if (me.is_admin) load();
  }, [me.is_admin, load]);

  if (!me.is_admin) {
    return (
      <Panel>
        <EmptyState title="Admins only" text="This page is for the people running HookLens. Set ADMIN_EMAILS on the server to include your email." />
      </Panel>
    );
  }

  const shown = (rows ?? []).filter((r) => !filter || r.category === filter);

  return (
    <>
      <PageHeader crumbs={["Dashboard", "Admin", "Feedback"]} title="Feedback" subtitle="What people sent through the in-app form, newest first." />
      <Panel flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <Select value={filter} onChange={setFilter}>
            <option value="">All categories</option>
            <option value="bug">Bugs</option>
            <option value="idea">Ideas</option>
            <option value="question">Questions</option>
            <option value="other">Other</option>
          </Select>
          <span className="ml-auto text-xs text-zinc-600">{shown.length} message{shown.length === 1 ? "" : "s"}</span>
        </div>
        {rows === null ? (
          <div className="p-10 text-center text-sm text-zinc-600">Loading…</div>
        ) : shown.length === 0 ? (
          <EmptyState title="No feedback yet" text="Messages sent from the Send feedback button show up here." />
        ) : (
          <TableWrap>
            <table className={tbl + " min-w-[760px]"}>
              <thead><tr className="border-b border-white/[0.06]"><Th>When</Th><Th>From</Th><Th>Type</Th><Th>Message</Th><Th /></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {shown.map((r) => (
                  <tr key={r.id} className="align-top transition hover:bg-white/[0.03]">
                    <Td className="whitespace-nowrap text-zinc-500">{timeAgo(r.created_at)}</Td>
                    <Td className="whitespace-nowrap text-zinc-400">{r.email}{r.page && <div className="font-mono text-[11px] text-zinc-600">{r.page}</div>}</Td>
                    <Td><Pill tone={tone[r.category]}>{r.category}</Pill></Td>
                    <Td className="max-w-xl whitespace-pre-wrap break-words text-zinc-200">{r.message}</Td>
                    <Td className="text-right"><Button variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => setDel(r)}>Delete</Button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {del && (
        <Modal title="Delete this feedback?" onClose={() => setDel(null)}>
          <p className="text-sm leading-relaxed text-zinc-400">It will be removed permanently.</p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
            <Button variant="danger" onClick={async () => { await api("DELETE", `/api/v1/admin/feedback/${del.id}`); toast("Deleted"); setDel(null); load(); }}>Delete</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Feedback />
    </Shell>
  );
}
