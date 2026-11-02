"use client";

import { useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Button, ErrorNote, Input } from "@/components/ui";
import { Field, Modal, PageHeader, Panel, Select } from "@/components/app";
import { useToast } from "@/components/toast";
import { api, formatBytes } from "@/lib/api";

/** One settings section: title and help on the left, controls on the right. */
function Section({ title, desc, children, danger = false }: { title: string; desc: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`grid gap-4 border-b border-white/[0.06] px-6 py-7 last:border-0 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10 ${danger ? "bg-red-500/[0.02]" : ""}`}>
      <div>
        <h2 className={`text-[15px] font-semibold ${danger ? "text-red-300" : "text-zinc-100"}`}>{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{desc}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Settings() {
  const { me, refresh } = useApp();
  const toast = useToast();
  const [retention, setRetention] = useState(String(me.user.retention_days));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pw, setPw] = useState("");

  async function saveRetention() {
    setSaving(true);
    setError("");
    try {
      await api("PATCH", "/api/v1/me", { retention_days: Number(retention) });
      toast("Retention updated");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader crumbs={["Dashboard", "Settings"]} title="Settings" subtitle="Your account, data retention and limits." />
      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <Panel flush>
        <Section title="Account" desc="The email you sign in with.">
          <dl className="grid max-w-md grid-cols-[8rem_1fr] gap-y-3 text-sm">
            <dt className="text-zinc-500">Email</dt><dd className="text-zinc-100">{me.user.email}</dd>
            <dt className="text-zinc-500">Member since</dt><dd className="text-zinc-300">{new Date(me.user.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}</dd>
            <dt className="text-zinc-500">Plan</dt><dd className="text-zinc-300">Free (beta)</dd>
          </dl>
        </Section>

        <Section title="Sessions" desc="Browsers currently signed in to your account.">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-zinc-300"><b className="tabular-nums text-white">{me.active_sessions}</b> active session{me.active_sessions === 1 ? "" : "s"}</span>
            <Button variant="outline" onClick={async () => { await api("POST", "/api/v1/auth/logout-all", {}); window.location.href = "/login/"; }}>Log out of all sessions</Button>
          </div>
        </Section>

        <Section title="Data retention" desc="Captured requests are deleted automatically after this period. Shorter is safer for sensitive payloads.">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Keep requests for">
              <Select value={retention} onChange={setRetention} className="w-44">
                {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
              </Select>
            </Field>
            <Button variant="outline" onClick={saveRetention} disabled={saving || retention === String(me.user.retention_days)}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </Section>

        <Section title="Plan limits" desc="Beta limits that keep the service fast for everyone.">
          <table className="w-full max-w-md text-sm">
            <tbody className="divide-y divide-white/[0.06]">
              <tr><td className="py-2.5 text-zinc-500">Endpoints</td><td className="py-2.5 text-right text-zinc-200">{me.limits.max_endpoints}</td></tr>
              <tr><td className="py-2.5 text-zinc-500">Simultaneous tunnels</td><td className="py-2.5 text-right text-zinc-200">{me.limits.max_tunnels}</td></tr>
              <tr><td className="py-2.5 text-zinc-500">Payload size</td><td className="py-2.5 text-right text-zinc-200">{formatBytes(me.limits.max_body_bytes)}</td></tr>
            </tbody>
          </table>
        </Section>

        <Section danger title="Delete account" desc="Permanently deletes your account, endpoints and every captured request. This cannot be undone.">
          <Button variant="danger" onClick={() => setDeleting(true)}>Delete account…</Button>
        </Section>
      </Panel>

      {deleting && (
        <Modal title="Delete your account?" onClose={() => setDeleting(false)}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                await api("DELETE", "/api/v1/me", { password: pw });
                window.location.href = "/";
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not delete account");
                setDeleting(false);
              }
            }}
          >
            <p className="text-sm leading-relaxed text-zinc-400">Everything will be erased immediately. Enter your password to confirm.</p>
            <Field label="Password"><Input type="password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <div className="flex justify-end gap-2.5 pt-1">
              <Button type="button" variant="ghost" onClick={() => setDeleting(false)}>Cancel</Button>
              <Button type="submit" variant="danger">Delete everything</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Settings />
    </Shell>
  );
}
