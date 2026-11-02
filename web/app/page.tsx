import Link from "next/link";
import { Logo } from "@/components/ui";
import { MockInspector, PipelineHero, Reveal } from "@/components/fx";

const features = [
  ["01", "A public URL for localhost", "One command gives your local server a webhook URL. Works behind NAT and firewalls because the tunnel connects outbound."],
  ["02", "Live request inspector", "Method, headers, query, exact raw body, source IP and size, streamed to your browser the moment a request lands."],
  ["03", "Replay any event", "Handler returned 500? Fix the bug and replay the saved request. No second test payment needed."],
  ["04", "Capture even when offline", "Webhooks are stored whether or not your CLI is connected. Reconnect later and replay what you missed."],
  ["05", "Delivery results", "See what your local server answered: status, headers, body and response time for every forward and replay."],
  ["06", "Built for debugging", "Search payloads, filter by result, and keep raw bytes intact so your own signature checks still pass."],
];

const steps = [
  ["Create an endpoint", "Sign up and get a public capture URL in seconds."],
  ["Run the CLI", "hooklens listen 3000 connects outbound. No port forwarding."],
  ["Point your provider at it", "Paste the URL into Stripe, Razorpay, GitHub or any HTTP webhook sender."],
  ["Inspect and replay", "Watch requests arrive live and re-send them as often as you need."],
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[44rem]" aria-hidden />

      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo className="text-lg" />
        <nav className="flex items-center gap-5 text-sm text-slate-400">
          <Link href="/docs/" className="transition hover:text-white">Docs</Link>
          <Link href="/login/" className="transition hover:text-white">Log in</Link>
          <Link href="/signup/" className="btn-glow rounded-lg bg-brand px-4 py-1.5 font-semibold text-ink-950">Get started free</Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:pt-24">
        <p className="rise mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-xs text-slate-400" style={{ ["--d" as string]: "0ms" }}>
          <span className="live-dot" /> Free during beta · built for payment &amp; API integrations
        </p>
        <h1 className="rise font-display mx-auto max-w-4xl text-[2.6rem] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl" style={{ ["--d" as string]: "80ms" }}>
          Your localhost, <span className="text-gradient">reachable by every webhook</span>
        </h1>
        <p className="rise mx-auto mt-6 max-w-2xl text-lg text-slate-400" style={{ ["--d" as string]: "180ms" }}>
          Payment providers can&apos;t call <code className="rounded bg-white/5 px-1.5 py-0.5 text-slate-200">localhost</code>. HookLens gives it a public URL, shows you every request, and lets you replay the ones that failed.
        </p>
        <div className="rise mt-9 flex flex-wrap justify-center gap-3" style={{ ["--d" as string]: "280ms" }}>
          <Link href="/signup/" className="btn-glow rounded-lg bg-brand px-6 py-3 font-semibold text-ink-950">Get started free</Link>
          <Link href="/docs/" className="rounded-lg border border-white/10 bg-white/[0.03] px-6 py-3 text-slate-200 transition hover:border-white/25 hover:bg-white/[0.07]">Read the docs</Link>
        </div>
        <div className="rise mt-14" style={{ ["--d" as string]: "400ms" }}>
          <PipelineHero />
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-4 py-12">
        <Reveal>
          <MockInspector />
        </Reveal>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <Reveal><h2 className="font-display mb-12 text-center text-3xl font-semibold text-white sm:text-4xl">From provider to localhost in four steps</h2></Reveal>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <Reveal delay={i * 90}>
                <div className="glass h-full rounded-xl p-5 transition duration-300 hover:-translate-y-1 hover:border-white/15">
                  <div className="font-display mb-3 text-4xl font-bold text-brand/80">{i + 1}</div>
                  <h3 className="font-semibold text-white">{t}</h3>
                  <p className="mt-1.5 text-sm text-slate-400">{d}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-4 py-16">
        <Reveal><h2 className="font-display mb-12 text-center text-3xl font-semibold text-white sm:text-4xl">Everything you need to debug a webhook</h2></Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([n, t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 90}>
              <div className="glass group h-full rounded-xl p-6 transition duration-300 hover:-translate-y-1 hover:border-brand/30">
                <div className="mb-4 font-mono text-xs text-brand/70">{n}</div>
                <h3 className="font-display text-lg font-semibold text-white">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-4 py-16 text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold text-white">Works with anything that sends HTTP webhooks</h2>
          <p className="mt-4 text-slate-400">
            Stripe, Razorpay, GitHub, Shopify, Twilio, your own services. HookLens captures and forwards the exact request without modifying the body, so your own signature verification keeps working.
          </p>
        </Reveal>
      </section>

      <section id="install" className="relative z-10 mx-auto max-w-3xl px-4 py-16">
        <Reveal>
          <h2 className="font-display mb-6 text-center text-3xl font-semibold text-white">Install the CLI</h2>
          <div className="glass overflow-hidden rounded-xl">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="ml-3 text-xs text-slate-500">terminal</span>
            </div>
            <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-slate-200">{`# download the binary for macOS, Linux or Windows from GitHub Releases, or:
go install github.com/hooklens/hooklens/cmd/hooklens@latest

hooklens login
hooklens listen 3000`}</pre>
          </div>
        </Reveal>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-4 py-16">
        <Reveal>
          <div className="glass beam relative overflow-hidden rounded-2xl p-10 text-center">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" aria-hidden />
            <div className="relative">
              <div className="text-xs uppercase tracking-[0.2em] text-brand">Beta pricing</div>
              <div className="font-display mt-2 text-6xl font-bold text-white">Free</div>
              <ul className="mx-auto mt-6 grid max-w-sm gap-2 text-left text-sm text-slate-300">
                <li>✓ 10 endpoints</li>
                <li>✓ 5 simultaneous CLI tunnels</li>
                <li>✓ 1 MB payloads</li>
                <li>✓ 7-day retention by default, up to 30</li>
              </ul>
              <Link href="/signup/" className="btn-glow mt-8 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-ink-950">Get started free</Link>
              <p className="mt-4 text-xs text-slate-500">Paid plans may come later. Nothing you create during the beta is taken away without notice.</p>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-10 text-center text-sm text-slate-500">
        <Logo className="text-sm" /> · <Link href="/docs/" className="hover:text-slate-300">Docs</Link> · <Link href="/login/" className="hover:text-slate-300">Log in</Link>
      </footer>
    </div>
  );
}
