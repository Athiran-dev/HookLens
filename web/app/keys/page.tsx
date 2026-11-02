"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Button, ErrorNote, Input } from "@/components/ui";
import { CopyIconButton, EmptyState, Field, Modal, PageHeader, Panel, Pill, TableWrap, TerminalBlock, Td, Th, tbl } from "@/components/app";
import { IconPlus } from "@/components/icons";
import { useToast } from "@/components/toast";
import { api, timeAgo } from "@/lib/api";

type Token = { id: string; kind: "cli" | "api"; name: string; created_at: string; last_used_at: string | null };

function Keys() {
  const toast = useToast();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState("");
  const [revoke, setRevoke] = useState<Token | null>(null);

  const load = useCallback(async () => setTokens(await api<Token[]>("GET", "/api/v1/tokens").catch(() => [])), []);
  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ token: string }>("POST", "/api/v1/tokens", { name });
      setNewKey(r.token);
      setCreating(false);
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key");
    }
  }

  return (
    <>
      <PageHeader crumbs={["Dashboard", "API Keys"]} title="API Keys" subtitle="Keys let the CLI and scripts act as you without a browser. Treat them like passwords.">
        <Button onClick={() => setCreating(true)}><IconPlus /> Create key</Button>
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel flush>
          {tokens === null ? (
            <div className="p-10 text-center text-sm text-zinc-600">Loading…</div>
          ) : tokens.length === 0 ? (
            <EmptyState title="No keys or CLI logins yet" text="CLI logins appear here after you run hooklens login. Create an API key for CI or servers.">
              <Button onClick={() => setCreating(true)}><IconPlus /> Create key</Button>
            </EmptyState>
          ) : (
            <TableWrap>
              <table className={tbl}>
                <thead><tr className="border-b border-white/[0.06]"><Th>Name</Th><Th>Type</Th><Th>Created</Th><Th>Last used</Th><Th /></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {tokens.map((t) => (
                    <tr key={t.id} className="transition hover:bg-white/[0.03]">
                      <Td className="font-medium text-zinc-100">{t.name}</Td>
                      <Td><Pill tone={t.kind === "api" ? "orange" : "gray"}>{t.kind === "api" ? "API key" : "CLI login"}</Pill></Td>
                      <Td className="whitespace-nowrap text-zinc-500">{new Date(t.created_at).toLocaleDateString()}</Td>
                      <Td className="whitespace-nowrap text-zinc-500">{t.last_used_at ? timeAgo(t.last_used_at) : "Never"}</Td>
                      <Td className="text-right"><Button variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => setRevoke(t)}>Revoke</Button></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>

        <Panel title="Using a key">
          <p className="mb-3 text-sm text-zinc-400">Sign the CLI in non-interactively:</p>
          <TerminalBlock copy="hooklens login --token hlk_…">{`$ hooklens login --token hlk_…`}</TerminalBlock>
          <p className="mb-3 mt-5 text-sm text-zinc-400">Or set an environment variable (CI, containers):</p>
          <TerminalBlock copy="HOOKLENS_TOKEN=hlk_… hooklens listen 3000">{`$ HOOKLENS_TOKEN=hlk_… hooklens listen 3000`}</TerminalBlock>
          <p className="mt-5 text-xs leading-relaxed text-zinc-600">Keys are shown once when created and stored only as a hash. Revoking a key signs out anything using it immediately.</p>
        </Panel>
      </div>

      {creating && (
        <Modal title="Create API key" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label="Name" hint="Where will this key be used? For example “laptop” or “GitHub Actions”.">
              <Input required autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="laptop" />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2.5 pt-1">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit">Create key</Button>
            </div>
          </form>
        </Modal>
      )}

      {newKey && (
        <Modal title="Copy your new key" onClose={() => setNewKey("")} width="max-w-lg">
          <p className="mb-4 text-sm text-zinc-400">This is the only time the full key is shown. Store it somewhere safe.</p>
          <div className="flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/[0.06] py-1 pl-3 pr-1">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-white">{newKey}</code>
            <CopyIconButton text={newKey} />
          </div>
          <div className="mt-6 flex justify-end"><Button onClick={() => setNewKey("")}>I&apos;ve saved it</Button></div>
        </Modal>
      )}

      {revoke && (
        <Modal title="Revoke this key?" onClose={() => setRevoke(null)}>
          <p className="text-sm leading-relaxed text-zinc-400">Anything using <b className="text-zinc-200">{revoke.name}</b> will be signed out immediately. This cannot be undone.</p>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setRevoke(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api("DELETE", `/api/v1/tokens/${revoke.id}`);
                toast(`${revoke.name} revoked`);
                setRevoke(null);
                load();
              }}
            >
              Revoke key
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Shell>
      <Keys />
    </Shell>
  );
}
