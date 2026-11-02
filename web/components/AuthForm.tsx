"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorNote, Input, Logo } from "@/components/ui";

function Form({ mode }: { mode: "login" | "signup" }) {
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("POST", `/api/v1/auth/${mode}`, { email, password });
      // only follow same-site relative redirects
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8">
        <Logo height={40} />
      </Link>
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-semibold text-white">{signup ? "Create your account" : "Welcome back"}</h1>
        <p className="mb-5 text-sm text-slate-400">{signup ? "Free during beta. No credit card." : "Log in to your HookLens workspace."}</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400" htmlFor="email">Email</label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400" htmlFor="password">Password</label>
            <Input id="password" type="password" required minLength={8} maxLength={72} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            {signup && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
          </Button>
        </form>
      </Card>
      <p className="mt-5 text-sm text-slate-400">
        {signup ? "Already have an account? " : "New to HookLens? "}
        <Link className="text-brand hover:underline" href={signup ? "/login/" : "/signup/"}>
          {signup ? "Log in" : "Sign up free"}
        </Link>
      </p>
    </div>
  );
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  return (
    <Suspense>
      <Form mode={mode} />
    </Suspense>
  );
}
