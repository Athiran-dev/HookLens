import Link from "next/link";
import { Logo } from "@/components/ui";

const features = [
  ["Public URL for localhost", "One command gives your local server a webhook URL that works behind NAT and firewalls."],
  ["Live request inspector", "Method, headers, query, exact raw body, source IP and size, streamed to your browser the moment it lands."],
  ["Replay any event", "Your handler returned 500? Fix the bug and replay the saved request. No second test payment needed."],
  ["Capture even when offline", "Webhooks are stored whether or not your CLI is connected. Reconnect later and replay what you missed."],
  ["Delivery results", "See what your local server answered: status, headers, body and response time, for every forward and replay."],
  ["Built for debugging", "Search payloads, filter by result, and keep the raw bytes intact so your own signature checks still pass."],
];

const steps = [
  ["Create an endpoint", "Sign up and get a public capture URL in seconds."],
  ["Run the CLI", "hooklens listen 3000 connects your machine outbound. No port forwarding."],
  ["Point your provider at it", "Paste the URL into Stripe, Razorpay, GitHub or any sender of HTTP webhooks."],
  ["Inspect and replay", "Watch requests arrive live and re-send them as often as you need."],
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Logo className="text-lg" />
        <nav className="flex items-center gap-5 text-sm text-slate-400">
          <Link href="/docs/" className="hover:text-white">Docs</Link>
          <Link href="/login/" className="hover:text-white">Log in</Link>
          <Link href="/signup/" className="rounded-md bg-brand px-3.5 py-1.5 font-semibold text-ink-950 hover:bg-emerald-300">Get started free</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-14 text-center">
        <p className="mb-4 inline-block rounded-full border border-ink-600 px-3 py-1 text-xs text-slate-400">Free during beta · Open to all developers</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
          Inspect, forward and replay webhooks <span className="text-brand">without leaving your dev workflow</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
          Your payment provider can&apos;t reach <code className="text-slate-200">localhost</code>. HookLens gives it a public URL, shows you every request, and lets you replay failures.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup/" className="rounded-md bg-brand px-5 py-2.5 font-semibold text-ink-950 hover:bg-emerald-300">Get started free</Link>
          <Link href="/docs/" className="rounded-md border border-ink-600 px-5 py-2.5 text-slate-200 hover:bg-ink-700">Read the docs</Link>
        </div>

        <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-lg border border-ink-700 bg-ink-900 text-left shadow-2xl shadow-black/40">
          <div className="flex items-center gap-1.5 border-b border-ink-700 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" /><span className="h-2.5 w-2.5 rounded-full bg-ink-600" /><span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            <span className="ml-3 text-xs text-slate-500">terminal · example output</span>
          </div>
          <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-slate-300">{`$ hooklens listen 3000

  ✓ Authenticated
  ✓ Connected to HookLens
  ✓ Local server detected

  Public URL (give this to your webhook provider):
  https://your-host/hook/k3j2m9x7q4…

  Waiting for incoming webhooks...

  14:02:11  POST   /api/webhooks/razorpay   → `}<span className="text-emerald-300">200</span>{`  (35ms)
  14:02:48  POST   /api/webhooks/razorpay   → `}<span className="text-red-300">500</span>{`  (12ms)
$ hooklens replay 6f1c…   `}<span className="text-slate-500"># fixed the bug, re-send the failed event</span></pre>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="mb-8 text-center text-2xl font-semibold text-white">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="rounded-lg border border-ink-700 bg-ink-800 p-4">
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">{i + 1}</div>
              <h3 className="font-semibold text-white">{t}</h3>
              <p className="mt-1 text-sm text-slate-400">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="mb-8 text-center text-2xl font-semibold text-white">Everything you need to debug a webhook</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([t, d]) => (
            <div key={t} className="rounded-lg border border-ink-700 bg-ink-800 p-5">
              <h3 className="font-semibold text-white">{t}</h3>
              <p className="mt-1.5 text-sm text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h2 className="text-2xl font-semibold text-white">Works with anything that sends HTTP webhooks</h2>
        <p className="mt-3 text-slate-400">
          Stripe, Razorpay, GitHub, Shopify, Twilio, your own services. HookLens captures and forwards the exact request; it doesn&apos;t modify bodies, so your own signature verification keeps working.
        </p>
      </section>

      <section id="install" className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="mb-6 text-center text-2xl font-semibold text-white">Install the CLI</h2>
        <pre className="overflow-x-auto rounded-lg border border-ink-700 bg-ink-900 p-5 text-[13px] text-slate-200">{`# Download the binary for macOS, Linux or Windows from GitHub Releases, or:
go install github.com/hooklens/hooklens/cmd/hooklens@latest

hooklens version
hooklens login
hooklens listen 3000`}</pre>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="mb-6 text-center text-2xl font-semibold text-white">Pricing</h2>
        <div className="rounded-lg border border-brand/40 bg-ink-800 p-6 text-center">
          <div className="text-sm uppercase tracking-wide text-brand">Beta</div>
          <div className="mt-1 text-4xl font-bold text-white">Free</div>
          <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-sm text-slate-300">
            <li>✓ 10 endpoints</li>
            <li>✓ 5 simultaneous CLI tunnels</li>
            <li>✓ 1 MB payloads</li>
            <li>✓ Up to 30 days retention (7 by default)</li>
          </ul>
          <Link href="/signup/" className="mt-6 inline-block rounded-md bg-brand px-5 py-2.5 font-semibold text-ink-950 hover:bg-emerald-300">Get started free</Link>
          <p className="mt-3 text-xs text-slate-500">Paid plans may come later; nothing you create during the beta will be taken away without notice.</p>
        </div>
      </section>

      <footer className="border-t border-ink-700 py-8 text-center text-sm text-slate-500">
        <Logo className="text-sm" /> · <Link href="/docs/" className="hover:text-slate-300">Docs</Link> · <Link href="/login/" className="hover:text-slate-300">Log in</Link>
      </footer>
    </div>
  );
}
