"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Shell from "@/components/Shell";
import { Button, Card, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";

function Approve() {
  const code = (useSearchParams().get("code") ?? "").toUpperCase();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function approve() {
    setState("busy");
    setError("");
    try {
      await api("POST", "/api/v1/cli/auth/approve", { user_code: code });
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve");
      setState("idle");
    }
  }

  return (
    <Card className="mx-auto mt-10 max-w-md p-6 text-center">
      {state === "done" ? (
        <>
          <h1 className="text-lg font-semibold text-white">CLI connected</h1>
          <p className="mt-2 text-sm text-slate-400">You can close this tab and return to your terminal.</p>
        </>
      ) : (
        <>
          <h1 className="text-lg font-semibold text-white">Authorize the HookLens CLI?</h1>
          <p className="mt-2 text-sm text-slate-400">Confirm this code matches the one shown in your terminal:</p>
          <div className="my-4 rounded-md bg-ink-950 py-3 font-mono text-2xl tracking-widest text-brand">{code || "—"}</div>
          {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
          <Button onClick={approve} disabled={!code || state === "busy"} className="w-full">
            {state === "busy" ? "Authorizing…" : "Authorize"}
          </Button>
          <p className="mt-3 text-xs text-slate-500">Only approve if you just ran <code>hooklens login</code>. You can revoke CLI logins in Settings.</p>
        </>
      )}
    </Card>
  );
}

export default function Page() {
  return (
    <Shell>
      <Suspense>
        <Approve />
      </Suspense>
    </Shell>
  );
}
