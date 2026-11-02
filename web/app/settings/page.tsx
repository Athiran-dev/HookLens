"use client";

import { useCallback, useEffect, useState } from "react";
import Shell, { useMeContext } from "@/components/Shell";
import { Button, Card, CopyButton, ErrorNote, Input, PageTitle } from "@/components/ui";
import { api, formatBytes, timeAgo } from "@/lib/api";

type Token = { id: string; kind: "cli" | "api"; name: string; created_at: string; last_used_at: string | null };

function Section({ title, children, desc }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-5 p-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {desc && <p className="mb-4 mt-1 text-sm text-slate-400">{desc}</p>}
      {!desc && <div className="mb-3" />}
      {children}
    </Card>
  );
}

function Settings() {
  const { me, refresh } = useMeContext();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [error, setError] = useState("");
  const [retention, setRetention] = useState(me.user.retention_days);
  const [saved, setSaved] = useState(false);
  const [delPw, setDelPw] = useState("");

  const loadTokens = useCallback(async () => setTokens(await api<Token[]>("GET", "/api/v1/tokens")), []);
  useEffect(() => {
    loadTokens().catch(() => {});
  }, [loadTokens]);

  async function guard(fn: () => Promise<void>) {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <>
      <PageTitle title="Settings" />
      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <Section title="Profile">
        <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">Email</dt><dd>{me.user.email}</dd>
          <dt className="text-slate-500">Member since</dt><dd>{new Date(me.user.created_at).toLocaleDateString()}</dd>
          <dt className="text-slate-500">Active sessions</dt>
          <dd className="flex items-center gap-3">
            {me.active_sessions}
            <Button variant="outline" className="!px-2.5 !py-1 text-xs" onClick={() => guard(async () => { await api("POST", "/api/v1/auth/logout-all", {}); window.location.href = "/login/"; })}>
              Log out of all sessions
            </Button>
          </dd>
        </dl>
      </Section>

      <Section title="Usage limits" desc="Beta limits that keep the service fast for everyone.">
        <ul className="space-y-1 text-sm text-slate-300">
          <li>Up to {me.limits.max_endpoints} endpoints</li>
          <li>Up to {me.limits.max_tunnels} simultaneous CLI tunnels</li>
          <li>Payloads up to {formatBytes(me.limits.max_body_bytes)}</li>
        </ul>
      </Section>

      <Section title="Data retention" desc="Captured requests are deleted automatically after this many days.">
        <div className="flex items-center gap-3">
          <select value={retention} onChange={(e) => { setRetention(Number(e.target.value)); setSaved(false); }} className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-slate-200">
            {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
          </select>
          <Button variant="outline" onClick={() => guard(async () => { await api("PATCH", "/api/v1/me", { retention_days: retention }); setSaved(true); refresh(); })}>Save</Button>
          {saved && <span className="text-sm text-brand">Saved</span>}
        </div>
      </Section>

      <Section title="API keys & CLI logins" desc="Use an API key with `hooklens login --token` or the HOOKLENS_TOKEN variable (for CI or servers). Tokens are shown once.">
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            guard(async () => {
              const r = await api<{ token: string }>("POST", "/api/v1/tokens", { name: keyName });
              setNewKey(r.token);
              setKeyName("");
              await loadTokens();
            });
          }}
        >
          <Input required maxLength={60} placeholder="Key name, e.g. laptop" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
          <Button type="submit" className="whitespace-nowrap">Create key</Button>
        </form>
        {newKey && (
          <div className="mb-4 rounded-md border border-brand/40 bg-brand/5 p-3">
            <p className="mb-2 text-xs text-slate-300">Copy this key now. You won&apos;t see it again.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-xs text-white">{newKey}</code>
              <CopyButton text={newKey} />
            </div>
          </div>
        )}
        {tokens.length === 0 ? (
          <p className="text-sm text-slate-500">No keys or CLI logins yet.</p>
        ) : (
          <ul className="divide-y divide-ink-700">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[11px] uppercase text-slate-300">{t.kind}</span>
                <span className="flex-1">{t.name}</span>
                <span className="text-xs text-slate-500">last used {timeAgo(t.last_used_at)}</span>
                <Button variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => guard(async () => { await api("DELETE", `/api/v1/tokens/${t.id}`); await loadTokens(); })}>Revoke</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Delete account" desc="Permanently deletes your account, endpoints and every captured request. This cannot be undone.">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!window.confirm("Delete your account and all data permanently?")) return;
            guard(async () => {
              await api("DELETE", "/api/v1/me", { password: delPw });
              window.location.href = "/";
            });
          }}
        >
          <Input type="password" required placeholder="Confirm with your password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
          <Button variant="danger" type="submit" className="whitespace-nowrap">Delete account</Button>
        </form>
      </Section>
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
