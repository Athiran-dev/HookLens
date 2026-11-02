import Link from "next/link";
import { Logo } from "@/components/ui";

function Block({ children }: { children: string }) {
  return <pre className="my-3 overflow-x-auto rounded-md border border-ink-700 bg-ink-900 p-3 text-xs leading-relaxed text-slate-200">{children}</pre>;
}

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="mb-2 mt-10 scroll-mt-20 text-lg font-semibold text-white">{children}</h2>;
}

export default function Docs() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-700">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/"><Logo /></Link>
          <nav className="flex gap-4 text-sm text-slate-400">
            <Link href="/dashboard/" className="hover:text-white">Dashboard</Link>
            <Link href="/signup/" className="text-brand hover:underline">Sign up free</Link>
          </nav>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-slate-300">
        <h1 className="text-2xl font-semibold text-white">HookLens documentation</h1>
        <p className="mt-2 text-slate-400">Receive webhooks on localhost, inspect every request, and replay events without triggering them again.</p>

        <H id="quickstart">Quickstart (3 minutes)</H>
        <ol className="list-decimal space-y-2 pl-5">
          <li><Link href="/signup/" className="text-brand hover:underline">Create an account</Link> and make an endpoint. You get a public URL like <code>https://your-host/hook/k3j2…</code>.</li>
          <li>Install the CLI (see below) and run <code>hooklens login</code>. Your browser opens to approve the login.</li>
          <li>Start your app (for example on port 3000) and run <code>hooklens listen 3000</code>.</li>
          <li>Paste the public URL into your provider&apos;s webhook settings (Razorpay, Stripe, GitHub, anything that sends HTTP).</li>
          <li>Trigger an event. It appears live in the dashboard and is forwarded to your local server.</li>
        </ol>

        <H id="install">Install the CLI</H>
        <p>Download the binary for your OS from the project&apos;s GitHub Releases page, put it on your PATH, and check it:</p>
        <Block>{`hooklens version`}</Block>
        <p>Building from source (needs Go):</p>
        <Block>{`go install github.com/hooklens/hooklens/cmd/hooklens@latest`}</Block>

        <H id="cli">CLI reference</H>
        <Block>{`hooklens login [--server URL] [--token KEY]   authenticate (browser flow, or an API key)
hooklens logout                               remove local credentials
hooklens listen <port|url> [--endpoint NAME]  forward webhooks to localhost
hooklens endpoints [create NAME]              list or create endpoints
hooklens requests [--endpoint NAME] [-n 20]   recent requests with results
hooklens replay <request-id>                  re-send a stored request through your tunnel
hooklens status                               connection status
hooklens version`}</Block>
        <p>Path and query string are preserved, so <code>/hook/&lt;token&gt;/api/webhooks/razorpay?x=1</code> reaches <code>http://localhost:3000/api/webhooks/razorpay?x=1</code>. For CI or servers use an API key: <code>HOOKLENS_TOKEN=hlk_… hooklens listen 3000</code>.</p>

        <H id="how">How it works</H>
        <p>The CLI opens one outbound WebSocket to HookLens (so it works behind NAT and firewalls). When a webhook arrives, HookLens stores it, acknowledges the sender immediately, then forwards it to your CLI, which calls localhost and reports back the response. The sender never waits on your dev server, and <strong>captured requests are kept even if your CLI is offline</strong>: reconnect and replay them.</p>
        <p className="mt-2">Each dashboard request shows two separate states: <em>received</em> (HookLens captured it) and <em>delivered / failed / not forwarded</em> (what your local server did).</p>

        <H id="replay">Replay</H>
        <p>Replay re-sends the saved request, including the original raw body and headers, to your connected tunnel. It is labelled with <code>X-HookLens-Replay: true</code>. Replaying can repeat business side effects (double charge, duplicate email), so make your webhook handlers idempotent, for example by de-duplicating on the provider&apos;s event ID.</p>

        <H id="signatures">Signature verification</H>
        <p>HookLens stores the exact bytes of every body and forwards them untouched, so your own signature checks (Stripe, Razorpay, GitHub, …) keep working locally. HookLens does <strong>not</strong> verify provider signatures itself.</p>

        <H id="limits">Limits &amp; privacy</H>
        <ul className="list-disc space-y-1 pl-5">
          <li>Payloads up to 1 MB; 20 requests/second per endpoint (burst 60).</li>
          <li>Up to 10 endpoints and 5 simultaneous tunnels per account.</li>
          <li>Requests are deleted automatically after your retention setting (default 7 days; 1 to 30 in Settings).</li>
          <li>The dashboard masks <code>Authorization</code>, <code>Cookie</code> and API-key headers. Anyone who knows an endpoint URL can send requests to it, so keep it private; you can disable or delete an endpoint at any time.</li>
          <li>Do not send real production secrets or regulated data through a beta service.</li>
        </ul>

        <H id="api">API</H>
        <p>The dashboard and CLI use the same JSON API under <code>/api/v1</code>. Authenticate with <code>Authorization: Bearer hlk_…</code> (create keys in Settings).</p>
        <Block>{`GET    /api/v1/endpoints
POST   /api/v1/endpoints              {"name": "...", "forward_url": "..."}
GET    /api/v1/endpoints/{id}/requests?q=&method=&status=&limit=
GET    /api/v1/requests/{id}
POST   /api/v1/requests/{id}/replay
GET    /api/v1/stats
ANY    /hook/{token}[/any/path]       public capture URL`}</Block>
      </article>
    </div>
  );
}
