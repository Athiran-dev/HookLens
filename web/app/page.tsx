import Link from "next/link";
import { Logo } from "@/components/ui";
import { MockInspector, PipelineHero, Reveal } from "@/components/fx";

const wrap = "mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12";

const steps = [
  ["Create an endpoint", "Sign up and get a public capture URL in seconds."],
  ["Run the CLI", "hooklens listen 3000 connects outbound. No port forwarding."],
  ["Point your provider at it", "Paste the URL into Stripe, Razorpay, GitHub or any HTTP webhook sender."],
  ["Inspect and replay", "Watch requests arrive live and re-send them as often as you need."],
];

const senders = ["Stripe", "Razorpay", "GitHub", "Shopify", "Twilio", "Slack", "Paddle", "Square", "Your own services"];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[52rem]" aria-hidden />

      <header className={`${wrap} relative z-10 flex h-[72px] items-center justify-between`}>
        <Logo height={32} />
        <nav className="flex items-center gap-4 whitespace-nowrap text-sm text-slate-400 sm:gap-7">
          <a href="#features" className="hidden transition hover:text-white md:inline">Features</a>
          <a href="#install" className="hidden transition hover:text-white md:inline">Install</a>
          <a href="#pricing" className="hidden transition hover:text-white md:inline">Pricing</a>
          <Link href="/docs/" className="hidden transition hover:text-white sm:inline">Docs</Link>
          <Link href="/login/" className="transition hover:text-white">Log in</Link>
          <Link href="/signup/" className="btn-glow rounded-lg bg-brand px-3.5 py-2 font-semibold text-ink-950 sm:px-5">Get started<span className="hidden sm:inline"> free</span></Link>
        </nav>
      </header>

      {/* ---------- hero: copy left, tilted 3D inspector right ---------- */}
      <section className={`${wrap} relative z-10 grid items-center gap-12 pb-16 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-8 lg:pb-24 lg:pt-20`}>
        <div>
          <p className="rise mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-xs text-slate-400" style={{ ["--d" as string]: "0ms" }}>
            <span className="live-dot" /> Free during beta · built for payment &amp; API integrations
          </p>
          <h1 className="rise font-display text-[2.7rem] font-bold leading-[1.04] tracking-tight text-white sm:text-6xl xl:text-7xl" style={{ ["--d" as string]: "80ms" }}>
            Your localhost,{" "}
            <span className="text-gradient">reachable by every webhook</span>
          </h1>
          <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-slate-400" style={{ ["--d" as string]: "180ms" }}>
            Payment providers can&apos;t call <code className="rounded bg-white/5 px-1.5 py-0.5 text-slate-200">localhost</code>. HookLens gives it a public URL, shows you every request, and lets you replay the ones that failed.
          </p>
          <div className="rise mt-9 flex flex-wrap gap-3" style={{ ["--d" as string]: "280ms" }}>
            <Link href="/signup/" className="btn-glow rounded-lg bg-brand px-7 py-3.5 font-semibold text-ink-950">Get started free</Link>
            <Link href="/docs/" className="rounded-lg border border-white/10 bg-white/[0.03] px-7 py-3.5 text-slate-200 transition hover:border-white/25 hover:bg-white/[0.07]">Read the docs</Link>
          </div>
          <ul className="rise mt-10 flex flex-wrap gap-x-7 gap-y-2 text-sm text-slate-500" style={{ ["--d" as string]: "380ms" }}>
            <li className="flex items-center gap-2"><span className="text-brand">✓</span> Works behind NAT &amp; firewalls</li>
            <li className="flex items-center gap-2"><span className="text-brand">✓</span> Raw bytes preserved</li>
            <li className="flex items-center gap-2"><span className="text-brand">✓</span> Replay without re-triggering</li>
          </ul>
        </div>

        <div className="rise relative" style={{ ["--d" as string]: "250ms" }}>
          <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-brand/10 blur-3xl" aria-hidden />
          <div className="[perspective:1800px]">
            <div className="transition-transform duration-700 ease-out lg:[transform:rotateY(-13deg)_rotateX(5deg)_rotateZ(0.6deg)] lg:hover:[transform:rotateY(-4deg)_rotateX(1deg)]">
              <MockInspector />
            </div>
          </div>
          <div className="float absolute -bottom-6 -left-3 hidden rounded-xl border border-white/10 bg-ink-900/90 px-4 py-2.5 text-xs shadow-2xl backdrop-blur sm:block lg:-left-10">
            <div className="mb-0.5 text-slate-500">Local server replied</div>
            <div className="font-mono text-emerald-300">200 OK · 35ms</div>
          </div>
          <div className="float absolute -right-2 -top-5 hidden rounded-xl border border-white/10 bg-ink-900/90 px-4 py-2.5 text-xs shadow-2xl backdrop-blur sm:block lg:-right-6" style={{ animationDelay: "-2.5s" }}>
            <div className="mb-0.5 text-slate-500">Fixed the bug?</div>
            <div className="font-mono text-amber-300">↻ replay request</div>
          </div>
        </div>
      </section>

      {/* ---------- senders marquee ---------- */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.015] py-5">
        <div className={`${wrap} flex items-center gap-8 overflow-hidden`}>
          <span className="hidden shrink-0 text-xs uppercase tracking-[0.2em] text-slate-600 md:block">Works with anything that sends HTTP</span>
          <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <div className="marquee flex w-max gap-10 text-lg font-medium text-slate-500">
              {[...senders, ...senders].map((s, i) => (
                <span key={i} className="whitespace-nowrap font-display">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- flow diagram, full width ---------- */}
      <section className={`${wrap} relative z-10 py-20 lg:py-28`}>
        <Reveal>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <div className="mb-3 text-xs uppercase tracking-[0.2em] text-brand">How it works</div>
              <h2 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">Stored first. Forwarded second. Never lost.</h2>
              <p className="mt-5 max-w-lg text-slate-400">
                Every webhook is captured and acknowledged immediately, then forwarded through your CLI&apos;s outbound connection. Your provider never waits on a slow dev server, and if your CLI is offline the request waits for you, ready to replay.
              </p>
            </div>
            <div className="glass rounded-2xl p-4 sm:p-8">
              <PipelineHero />
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- steps across the full width ---------- */}
      <section className={`${wrap} relative z-10 pb-20 lg:pb-28`}>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <Reveal delay={i * 90}>
                <div className="glass h-full rounded-xl p-6 transition duration-300 hover:-translate-y-1 hover:border-white/15">
                  <div className="font-display mb-4 text-5xl font-bold text-brand/70">{i + 1}</div>
                  <h3 className="font-semibold text-white">{t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{d}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- bento features ---------- */}
      <section id="features" className={`${wrap} relative z-10 pb-20 lg:pb-28`}>
        <Reveal>
          <h2 className="font-display mb-10 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">Everything you need to debug a webhook</h2>
        </Reveal>
        <div className="grid gap-4 lg:grid-cols-6">
          <Reveal className="lg:col-span-3">
            <div className="glass beam h-full rounded-2xl p-7">
              <div className="mb-3 font-mono text-xs text-brand/70">01 · live inspector</div>
              <h3 className="font-display text-2xl font-semibold text-white">See every request the moment it lands</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">Method, headers, query, exact raw body, source IP and size, streamed to your browser. Search payloads and filter by delivery result.</p>
              <pre className="mt-6 overflow-x-auto rounded-lg border border-white/5 bg-black/40 p-4 text-[12.5px] leading-relaxed text-slate-300">{`POST /webhooks/razorpay
X-Razorpay-Event: payment.captured

{ "event": "payment.captured",
  "payment": { "id": "pay_123", "amount": 50000 } }`}</pre>
            </div>
          </Reveal>
          <Reveal delay={90} className="lg:col-span-3">
            <div className="glass h-full rounded-2xl p-7">
              <div className="mb-3 font-mono text-xs text-brand/70">02 · replay</div>
              <h3 className="font-display text-2xl font-semibold text-white">Handler returned 500? Fix it and replay.</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">No second test payment needed. Replays are clearly labelled and warn you about idempotency.</p>
              <div className="mt-6 space-y-2 font-mono text-[13px]">
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 px-4 py-2.5"><span className="text-slate-300">POST /webhooks/razorpay</span><span className="rounded bg-red-400/10 px-2 py-0.5 text-red-300">500</span></div>
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 px-4 py-2.5"><span className="text-slate-300">↻ replay after fix</span><span className="rounded bg-emerald-400/10 px-2 py-0.5 text-emerald-300">200</span></div>
              </div>
            </div>
          </Reveal>
          {[
            ["03", "A public URL for localhost", "One command. Works behind NAT and firewalls because the tunnel connects outbound."],
            ["04", "Capture even when offline", "Webhooks are stored whether or not your CLI is connected. Reconnect later and replay what you missed."],
            ["05", "Delivery results", "Status, headers, body and response time from your local server, for every forward and replay."],
          ].map(([n, t, d], i) => (
            <Reveal key={t} delay={i * 90} className="lg:col-span-2">
              <div className="glass h-full rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-brand/30">
                <div className="mb-3 font-mono text-xs text-brand/70">{n}</div>
                <h3 className="font-display text-lg font-semibold text-white">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- install + pricing side by side ---------- */}
      <section className={`${wrap} relative z-10 grid gap-6 pb-24 lg:grid-cols-2 lg:pb-32`}>
        <Reveal>
          <div id="install" className="glass h-full overflow-hidden rounded-2xl">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="ml-3 text-xs text-slate-500">terminal</span>
            </div>
            <div className="p-7">
              <h2 className="font-display text-2xl font-semibold text-white">Install the CLI</h2>
              <p className="mt-2 text-sm text-slate-400">One static binary for macOS, Linux and Windows. No Node or Python needed.</p>
              <pre className="mt-5 overflow-x-auto rounded-lg border border-white/5 bg-black/40 p-5 text-[13px] leading-relaxed text-slate-200">{`# download from GitHub Releases, or:
go install github.com/hooklens/hooklens/cmd/hooklens@latest

hooklens login
hooklens listen 3000`}</pre>
            </div>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div id="pricing" className="glass beam relative h-full overflow-hidden rounded-2xl p-8">
            <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-72 rounded-full bg-brand/20 blur-3xl" aria-hidden />
            <div className="relative">
              <div className="text-xs uppercase tracking-[0.2em] text-brand">Beta pricing</div>
              <div className="mt-2 flex items-end gap-3">
                <span className="font-display text-6xl font-bold text-white">Free</span>
                <span className="mb-2 text-sm text-slate-500">while we&apos;re in beta</span>
              </div>
              <ul className="mt-6 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <li>✓ 10 endpoints</li>
                <li>✓ 5 simultaneous tunnels</li>
                <li>✓ 1 MB payloads</li>
                <li>✓ 7-day retention, up to 30</li>
              </ul>
              <Link href="/signup/" className="btn-glow mt-8 inline-block rounded-lg bg-brand px-7 py-3 font-semibold text-ink-950">Get started free</Link>
              <p className="mt-4 text-xs text-slate-500">Paid plans may come later. Nothing you create during the beta is taken away without notice.</p>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-10">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500`}>
          <Logo height={24} />
          <div className="flex gap-6">
            <Link href="/docs/" className="hover:text-slate-300">Docs</Link>
            <Link href="/login/" className="hover:text-slate-300">Log in</Link>
            <Link href="/signup/" className="hover:text-slate-300">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
