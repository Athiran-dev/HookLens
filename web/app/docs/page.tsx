import Link from "next/link";
import { Logo, MethodBadge } from "@/components/ui";
import { Panel, StatusDot, TerminalBlock } from "@/components/app";
import type { DeliveryBrief } from "@/lib/api";

const REPO = "https://github.com/Athiran-dev/HookLens";

const nav = [
  { group: "Start here", items: [
    { id: "what-is", label: "What is HookLens?" },
    { id: "paths", label: "Choose your path" },
    { id: "quickstart", label: "Quickstart" },
    { id: "install", label: "Install the CLI" },
  ] },
  { group: "Using HookLens", items: [
    { id: "dashboard", label: "Reading the dashboard" },
    { id: "replay", label: "Replay" },
    { id: "signatures", label: "Signature checks" },
    { id: "account", label: "Your account" },
    { id: "limits", label: "Limits and privacy" },
  ] },
  { group: "Help", items: [
    { id: "troubleshooting", label: "Troubleshooting" },
    { id: "glossary", label: "Glossary" },
    { id: "help", label: "Getting help" },
  ] },
  { group: "Advanced", items: [
    { id: "cli", label: "CLI reference" },
    { id: "api", label: "API reference" },
    { id: "self-host", label: "Run it yourself" },
  ] },
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="mb-3 mt-14 scroll-mt-24 font-display text-2xl font-semibold tracking-tight text-white">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 mt-6 text-[15px] font-semibold text-zinc-100">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">{children}</p>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[13px] text-zinc-200">{children}</code>;
}
function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  return <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className="text-brand hover:underline">{children}</a>;
}
function Note({ tone = "brand", title, children }: { tone?: "brand" | "amber" | "green"; title: string; children: React.ReactNode }) {
  const c = { brand: "border-brand/40 bg-brand/[0.06] text-brand", amber: "border-amber-400/30 bg-amber-400/[0.06] text-amber-300", green: "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300" }[tone];
  return (
    <div className={`mt-5 rounded-xl border px-4 py-3.5 ${c}`}>
      <div className="text-[13px] font-semibold uppercase tracking-wide">{title}</div>
      <div className="mt-1 text-[14px] leading-relaxed text-zinc-300">{children}</div>
    </div>
  );
}
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative border-l border-white/10 pb-7 pl-8 last:border-transparent last:pb-0">
      <span className="absolute -left-[15px] top-0 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-brand/50 bg-[#0a0a0b] text-sm font-semibold text-brand">{n}</span>
      <div className="text-[15px] font-semibold text-zinc-100">{title}</div>
      <div className="mt-1 text-[15px] leading-relaxed text-zinc-400">{children}</div>
    </li>
  );
}

const sample: { path: string; delivery: DeliveryBrief | null; label: string }[] = [
  { path: "/stripe/events", delivery: { id: "1", kind: "forward", status: "delivered", response_code: 200, duration_ms: 12 }, label: "Your app answered" },
  { path: "/stripe/events", delivery: { id: "2", kind: "forward", status: "failed", response_code: null, duration_ms: 3 }, label: "Your app was not reachable" },
  { path: "/github", delivery: { id: "3", kind: "forward", status: "no_tunnel", response_code: null, duration_ms: null }, label: "No CLI was connected" },
];

function Flow() {
  const box = "flex-1 rounded-xl border border-white/10 bg-[#111113] px-4 py-3.5 text-center";
  const arrow = <div className="flex items-center justify-center text-brand sm:px-1"><span className="rotate-90 text-xl sm:rotate-0">&rarr;</span></div>;
  return (
    <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-stretch">
        <div className={box}><div className="text-sm font-semibold text-zinc-100">A service</div><div className="mt-0.5 text-xs text-zinc-500">for example a payment provider</div></div>
        {arrow}
        <div className={`${box} !border-brand/50`}><div className="text-sm font-semibold text-brand">HookLens</div><div className="mt-0.5 text-xs text-zinc-500">gives you a public URL, saves every message</div></div>
        {arrow}
        <div className={box}><div className="text-sm font-semibold text-zinc-100">Your computer</div><div className="mt-0.5 text-xs text-zinc-500">your app on <span className="font-mono">localhost:3000</span></div></div>
      </div>
      <p className="mt-3 text-center text-xs text-zinc-500">You also see every message live in the HookLens dashboard in your browser.</p>
    </div>
  );
}

export default function Docs() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0a0b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/"><Logo height={26} /></Link>
            <span className="hidden rounded-md bg-white/[0.07] px-2 py-0.5 text-xs font-medium text-zinc-400 sm:inline">Docs</span>
          </div>
          <nav className="flex items-center gap-5 text-sm text-zinc-400">
            <Link href="/dashboard/" className="hover:text-white">Dashboard</Link>
            <Link href="/signup/" className="rounded-lg bg-brand px-3.5 py-1.5 font-semibold text-ink-950 hover:opacity-90">Sign up free</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl gap-12 px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="mb-8 lg:mb-0">
          <nav className="lg:sticky lg:top-24" aria-label="On this page">
            <div className="space-y-5 rounded-xl border border-white/[0.07] p-4 lg:border-0 lg:p-0">
              {nav.map((g) => (
                <div key={g.group}>
                  <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{g.group}</div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:block lg:space-y-0.5">
                    {g.items.map((i) => (
                      <li key={i.id}><a href={`#${i.id}`} className="block rounded-md py-1 text-sm text-zinc-400 transition hover:text-white lg:px-2 lg:hover:bg-white/[0.04]">{i.label}</a></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white">HookLens documentation</h1>
          <p className="mt-3 text-lg leading-relaxed text-zinc-400">Everything you need to receive webhooks on your own computer, see exactly what arrived, and send it again when something goes wrong.</p>

          <H id="what-is">What is HookLens?</H>
          <P>A <strong className="text-zinc-200">webhook</strong> is a message that another service sends to your app when something happens, for example when a payment succeeds or someone pushes code. To receive it, your app needs a public web address.</P>
          <P>An app running on your own computer (<strong className="text-zinc-200">localhost</strong>) has no public address, so those messages can never reach it while you build. HookLens gives you that address. It catches every message, shows it to you, and passes it on to your computer.</P>
          <Flow />
          <H3>What you get</H3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-zinc-400">
            <li><strong className="text-zinc-200">A public URL</strong> to paste into any service that sends webhooks.</li>
            <li><strong className="text-zinc-200">A live dashboard</strong> showing each message: its headers, its exact content, and what your app answered.</li>
            <li><strong className="text-zinc-200">Forwarding to localhost</strong> with one command, so your real app receives the message.</li>
            <li><strong className="text-zinc-200">Replay</strong>: if your app was off or had a bug, send the same message again later. You don&apos;t need to trigger the event again.</li>
          </ul>
          <Note tone="green" title="Who is it for?">Developers who build apps that react to webhooks, from payments to GitHub events. You don&apos;t need any other tool, and it is free while HookLens is in beta.</Note>

          <H id="paths">Choose your path</H>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { href: "#quickstart", t: "I want to see my webhooks", d: "Create an endpoint, paste the URL, watch messages appear. No install needed." },
              { href: "#install", t: "I am building on localhost", d: "Install the CLI so messages reach your app on your own computer." },
              { href: "#replay", t: "A webhook failed", d: "Find the message in the dashboard and replay it without re-triggering anything." },
            ].map((c) => (
              <a key={c.href} href={c.href} className="rounded-xl border border-white/[0.09] bg-[#111113] p-4 transition hover:border-brand/50">
                <div className="text-[15px] font-semibold text-zinc-100">{c.t}</div>
                <div className="mt-1.5 text-sm leading-relaxed text-zinc-500">{c.d}</div>
                <div className="mt-3 text-sm font-medium text-brand">Go &rarr;</div>
              </a>
            ))}
          </div>

          <H id="quickstart">Quickstart</H>
          <P>About three minutes. You need an account and, to forward to your computer, the CLI.</P>
          <ol className="mt-5">
            <Step n={1} title="Create an account and an endpoint">
              <Link href="/signup/" className="text-brand hover:underline">Sign up</Link>, then press <strong className="text-zinc-300">Create endpoint</strong>. An endpoint is one public URL, for example <Code>https://hooklens-app.onrender.com/hook/k3j2…</Code>. Keep it private, because anyone who has it can send messages to it.
            </Step>
            <Step n={2} title="Paste the URL into the service that sends webhooks">
              Open the webhook settings of your provider (payments, GitHub, anything that sends HTTP) and paste your endpoint URL. No provider yet? Press <strong className="text-zinc-300">Send test webhook</strong> on the endpoint page to see how a message looks.
            </Step>
            <Step n={3} title="Watch it arrive">
              Open the endpoint in the dashboard. Each message appears live, even if nothing is running on your computer. This is the whole setup if you only want to look at messages.
            </Step>
            <Step n={4} title="Optional: forward messages to your app">
              <A href="#install">Install the CLI</A>, start your app (say on port 3000), then run:
              <div className="mt-3"><TerminalBlock copy="hooklens login" title="one time">{`$ hooklens login`}</TerminalBlock></div>
              <div className="mt-3"><TerminalBlock copy="hooklens listen 3000" title="every time">{`$ hooklens listen 3000`}</TerminalBlock></div>
              <span className="mt-2 block">Your browser opens once to approve the login. After that, every message to your endpoint is delivered to <Code>localhost:3000</Code>.</span>
            </Step>
          </ol>
          <Note tone="amber" title="Free plan sleeps">HookLens runs on a free plan that sleeps when nobody has used it for a while. The first request after a quiet period can take up to a minute while it wakes up.</Note>

          <H id="install">Install the CLI</H>
          <P>The CLI is a small program called <Code>hooklens</Code>. It connects your computer to HookLens so messages can reach <Code>localhost</Code>. It only makes an outgoing connection, so it works behind home routers and firewalls.</P>
          <H3>Download a ready-made file (easiest)</H3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-zinc-400">
            <li>Open <A href={`${REPO}/releases/latest`}>GitHub Releases</A> and download the file for your system: <Code>hooklens-windows-amd64.exe</Code>, <Code>hooklens-darwin-arm64</Code> (Apple chip), <Code>hooklens-darwin-amd64</Code> (Intel Mac), <Code>hooklens-linux-amd64</Code> or <Code>hooklens-linux-arm64</Code>.</li>
            <li>Rename it to <Code>hooklens</Code> (<Code>hooklens.exe</Code> on Windows).</li>
            <li>Put it in a folder that is on your PATH, so the command works from any terminal.</li>
            <li>Check that it works:</li>
          </ol>
          <div className="mt-3"><TerminalBlock copy="hooklens version">{`$ hooklens version`}</TerminalBlock></div>
          <Note tone="amber" title="Windows warning">The downloads are not code-signed yet, so Windows SmartScreen may warn you the first time. Choose <strong>More info</strong>, then <strong>Run anyway</strong>.</Note>
          <H3>Or build it with Go</H3>
          <P>If you already have Go installed:</P>
          <div className="mt-3"><TerminalBlock copy="go install github.com/Athiran-dev/HookLens/cmd/hooklens@latest">{`$ go install github.com/Athiran-dev/HookLens/cmd/hooklens@latest`}</TerminalBlock></div>

          <H id="dashboard">Reading the dashboard</H>
          <P>Every request that reaches your endpoint is saved, and it has two separate states. <strong className="text-zinc-200">Received</strong> means HookLens saved it. The second state is what happened when HookLens passed it to your computer:</P>
          <div className="mt-4">
            <Panel flush>
              <ul className="divide-y divide-white/[0.05]">
                {sample.map((r, i) => (
                  <li key={i} className={`flex items-center gap-3 border-l-2 px-4 py-3 text-sm ${r.delivery?.status === "failed" ? "border-red-400/80" : r.delivery?.status === "delivered" ? "border-emerald-400/70" : "border-transparent"}`}>
                    <MethodBadge method="POST" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] text-zinc-100">{r.path}</span>
                      <span className="block text-[11px] text-zinc-600">{r.label}</span>
                    </span>
                    <span className="text-xs"><StatusDot delivery={r.delivery} /></span>
                  </li>
                ))}
              </ul>
            </Panel>
            <p className="mt-2 text-xs text-zinc-600">An example of the request list. Your own requests look like this.</p>
          </div>
          <dl className="mt-5 space-y-3 text-[15px] leading-relaxed text-zinc-400">
            <div><dt className="inline font-semibold text-emerald-400">Green, with a number (such as 200): </dt><dd className="inline">your app received the message and answered.</dd></div>
            <div><dt className="inline font-semibold text-red-400">Red, Failed: </dt><dd className="inline">HookLens could not reach your app, or it did not answer in time. The message is still saved.</dd></div>
            <div><dt className="inline font-semibold text-zinc-300">Grey, Captured or Not forwarded: </dt><dd className="inline">HookLens saved the message, but no CLI was connected, so nothing was sent to your computer.</dd></div>
          </dl>
          <P>Open any request to see its headers, its exact content, the response from your app and a timeline. The dashboard hides the <Code>Authorization</Code>, <Code>Cookie</Code> and API-key headers on screen.</P>

          <H id="replay">Replay</H>
          <P>Replay sends a saved message to your computer again, with the original content and headers. It is the quickest way to test a fix: change your code, press <strong className="text-zinc-200">Replay</strong>, and see the new result. You don&apos;t have to make the provider send it again.</P>
          <P>Replayed messages carry an extra header, <Code>X-HookLens-Replay: true</Code>, so your app can tell them apart. Replay needs your CLI to be running.</P>
          <Note title="Careful: replay can repeat side effects">If your app charges a card or sends an email when it gets a message, replaying may do it a second time. Make your handler <strong>idempotent</strong>, meaning safe to run twice, for example by ignoring an event ID it has already processed.</Note>

          <H id="signatures">Signature checks</H>
          <P>Many providers sign their messages so your app can tell they are genuine. HookLens passes the exact bytes through untouched, so your own signature check works locally. HookLens does <strong className="text-zinc-200">not</strong> check signatures itself.</P>

          <H id="account">Your account</H>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-zinc-400">
            <li><strong className="text-zinc-200">There is no password reset yet.</strong> Choose a password you will remember or keep it in a password manager. If you are locked out, open an issue on <A href={`${REPO}/issues`}>GitHub</A> and describe the problem without posting your password.</li>
            <li>In <strong className="text-zinc-200">Settings</strong> you can set how long requests are kept, create API keys, log out of all sessions, and delete your account.</li>
            <li>Deleting your account erases your endpoints and every saved request right away. It cannot be undone.</li>
          </ul>

          <H id="limits">Limits and privacy</H>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-zinc-400">
            <li>Messages up to 1 MB. Up to 20 requests per second to one endpoint (short bursts up to 60).</li>
            <li>Up to 10 endpoints and 5 CLI connections at the same time per account.</li>
            <li>Saved requests are deleted automatically after your retention setting: 7 days by default, between 1 and 30 days in Settings.</li>
            <li>Anyone who knows an endpoint URL can send messages to it, so keep it private. You can disable or delete an endpoint at any time.</li>
            <li>Do not send real production secrets or regulated data through a beta service.</li>
          </ul>

          <H id="troubleshooting">Troubleshooting</H>
          <div className="mt-4 space-y-3">
            {[
              { q: "“Connection refused: nothing is listening on localhost:3000”", a: <>Your app is not running on that port. Start it, or give <Code>hooklens listen</Code> the right port. The request was saved, so replay it once your app is up.</> },
              { q: "Requests show “Not forwarded”", a: <>No CLI is connected to that endpoint. Run <Code>hooklens listen</Code> and check the Tunnels page. Only one CLI forwards an endpoint at a time: starting a second one replaces the first, and <em>Disconnect</em> on the Tunnels page stops that CLI, which then does not reconnect on its own.</> },
              { q: "The first request is slow or times out", a: <>The free host was asleep and needs about a minute to wake. Retry, or send the event again from your provider&apos;s dashboard.</> },
              { q: "“Invalid email or password”", a: <>Check both, and make sure you have signed up on this server. See <A href="#account">Your account</A> for password help.</> },
              { q: "My signature check fails locally", a: <>HookLens forwards the exact bytes it received. Verify against the raw body, before any JSON parsing, using the signing secret for that provider. Events sent with <em>Send test webhook</em> are not signed by any provider.</> },
              { q: "Windows warns about the CLI download", a: <>The download is not code-signed yet. Choose <em>More info</em>, then <em>Run anyway</em>.</> },
            ].map((f) => (
              <details key={f.q} className="group rounded-xl border border-white/[0.09] bg-[#111113] px-4 py-3">
                <summary className="cursor-pointer list-none text-[15px] font-medium text-zinc-100 marker:hidden">
                  <span className="mr-2 inline-block text-brand transition group-open:rotate-90">&rsaquo;</span>{f.q}
                </summary>
                <p className="mt-2 pl-4 text-[15px] leading-relaxed text-zinc-400">{f.a}</p>
              </details>
            ))}
          </div>

          <H id="glossary">Glossary</H>
          <dl className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.09] bg-[#111113]">
            {[
              ["Webhook", "A message one service sends to your app when something happens."],
              ["Endpoint", "One HookLens public URL that receives webhooks. You can have several."],
              ["Localhost", "Your own computer. An app on localhost cannot be reached from the internet."],
              ["Tunnel", "The connection that carries messages from HookLens to your computer. The CLI opens it."],
              ["CLI", "A program you run in a terminal. Here, the hooklens command."],
              ["Payload", "The content of a message, usually JSON."],
              ["Replay", "Sending a saved message to your app again."],
              ["Idempotent", "Safe to run twice with the same result. Good webhook handlers are."],
              ["Signature", "A code a provider adds so your app can tell a message is genuine."],
              ["Retention", "How long HookLens keeps your saved requests before deleting them."],
            ].map(([t, d]) => (
              <div key={t} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <dt className="text-sm font-semibold text-zinc-100">{t}</dt>
                <dd className="text-sm leading-relaxed text-zinc-400">{d}</dd>
              </div>
            ))}
          </dl>

          <H id="help">Getting help</H>
          <P>Use <strong className="text-zinc-200">Send feedback</strong> in the dashboard menu, or open an issue on <A href={`${REPO}/issues`}>GitHub</A>. HookLens is in beta, so expect rough edges, and thank you for reporting them.</P>

          <div className="mt-16 border-t border-white/[0.06] pt-2">
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">Advanced</p>
          </div>

          <H id="cli">CLI reference</H>
          <TerminalBlock title="hooklens">{`hooklens login [--server URL] [--token KEY]   authenticate (browser flow, or an API key)
hooklens logout                               remove local credentials
hooklens listen <port|url> [--endpoint NAME]  forward webhooks to localhost
hooklens endpoints [create NAME]              list or create endpoints
hooklens requests [--endpoint NAME] [-n 20]   recent requests with results
hooklens replay <request-id>                  re-send a stored request through your tunnel
hooklens status                               connection status
hooklens version`}</TerminalBlock>
          <P>The path and query string are kept, so <Code>/hook/&lt;token&gt;/api/webhooks/razorpay?x=1</Code> reaches <Code>http://localhost:3000/api/webhooks/razorpay?x=1</Code>.</P>
          <P>For scripts and servers, use an API key instead of the browser login: <Code>HOOKLENS_TOKEN=hlk_… hooklens listen 3000</Code>. Create keys in Settings. To point the CLI at your own deployment, use <Code>--server</Code> or <Code>HOOKLENS_SERVER</Code>.</P>

          <H id="api">API reference</H>
          <P>The dashboard and the CLI use the same JSON API under <Code>/api/v1</Code>. Authenticate with <Code>Authorization: Bearer hlk_…</Code>.</P>
          <div className="mt-3">
            <TerminalBlock title="routes">{`GET    /api/v1/endpoints
POST   /api/v1/endpoints              {"name": "...", "forward_url": "..."}
GET    /api/v1/endpoints/{id}/requests?q=&method=&status=&limit=
GET    /api/v1/requests/{id}
POST   /api/v1/requests/{id}/replay
GET    /api/v1/stats
ANY    /hook/{token}[/any/path]       public capture URL`}</TerminalBlock>
          </div>

          <H id="self-host">Run it yourself</H>
          <P>The source code is on <A href={REPO}>GitHub</A>. The README explains how to run the whole stack on your own machine or deploy it to a free host, and lists every setting.</P>
        </article>
      </div>
    </div>
  );
}
