import Link from "next/link";
import { Logo } from "@/components/ui";

function Block({ children }: { children: string }) {
  return <pre className="my-3 overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-slate-200">{children}</pre>;
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
          <li>Trigger an event, or press <strong>Send test webhook</strong> on the endpoint page. It appears live in the dashboard and is forwarded to your local server.</li>
        </ol>
        <p className="mt-3 text-slate-400">HookLens runs on a free plan that sleeps when idle, so the first request after a quiet period can take up to a minute while it wakes up.</p>

        <H id="install">Install the CLI</H>
        <p>Download the file for your system from <a href="https://github.com/Athiran-dev/HookLens/releases/latest" className="text-brand hover:underline">GitHub Releases</a> (on Windows: <code>hooklens-windows-amd64.exe</code>), rename it to <code>hooklens</code> (<code>hooklens.exe</code> on Windows), put it on your PATH, and check it:</p>
        <Block>{`hooklens version`}</Block>
        <p>Building from source (needs Go):</p>
        <Block>{`go install github.com/Athiran-dev/HookLens/cmd/hooklens@latest`}</Block>

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

        <H id="account">Your account</H>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>There is no password reset yet.</strong> Choose a password you will remember or keep it in a password manager. If you are locked out, open an issue on <a href="https://github.com/Athiran-dev/HookLens/issues" className="text-brand hover:underline">GitHub</a> and describe the problem without posting your password.</li>
          <li>In <strong>Settings</strong> you can change the retention period, create API keys, log out of all sessions, and delete your account.</li>
          <li>Deleting your account erases your endpoints and every captured request immediately. It cannot be undone.</li>
        </ul>

        <H id="troubleshooting">Troubleshooting</H>
        <div className="space-y-4">
          <div>
            <p className="font-medium text-white">&ldquo;Connection refused: nothing is listening on localhost:3000&rdquo;</p>
            <p>Your app is not running on that port. Start it, or give <code>hooklens listen</code> the right port. The request was still saved, so replay it once your app is up.</p>
          </div>
          <div>
            <p className="font-medium text-white">Requests show &ldquo;Not forwarded&rdquo;</p>
            <p>No CLI is connected to that endpoint. Run <code>hooklens listen</code> and check the Tunnels page. Only one CLI forwards an endpoint at a time: starting a second one replaces the first, and <em>Disconnect</em> on the Tunnels page stops that CLI, which then does not reconnect on its own.</p>
          </div>
          <div>
            <p className="font-medium text-white">The first request is slow or times out</p>
            <p>The free host was asleep and needs about a minute to wake. Retry, or resend the event from your provider&apos;s dashboard.</p>
          </div>
          <div>
            <p className="font-medium text-white">&ldquo;Invalid email or password&rdquo;</p>
            <p>Check both, and make sure you have signed up on this server. See <a href="#account" className="text-brand hover:underline">Your account</a> for password help.</p>
          </div>
          <div>
            <p className="font-medium text-white">My signature check fails locally</p>
            <p>HookLens forwards the exact bytes it received. Verify against the raw body, before any JSON parsing, using the signing secret for that provider. Events sent with <em>Send test webhook</em> are not signed by any provider.</p>
          </div>
          <div>
            <p className="font-medium text-white">Windows warns about the CLI download</p>
            <p>Releases are unsigned. Choose <em>More info</em>, then <em>Run anyway</em>.</p>
          </div>
        </div>

        <H id="help">Getting help</H>
        <p>Use <strong>Send feedback</strong> in the dashboard menu, or open an issue on <a href="https://github.com/Athiran-dev/HookLens/issues" className="text-brand hover:underline">GitHub</a>. HookLens is in beta, so expect rough edges.</p>

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
