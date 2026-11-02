import Link from "next/link";
import { Logo } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { Eyebrow, MiniHistory, MiniInspector, MiniTerminal, ProductShot } from "@/components/landing";

const wrap = "mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-10";

const flow = [
  { title: "External Service", sub: "Stripe, Razorpay, GitHub…", icon: "↗" },
  { title: "HookLens", sub: "stores · acknowledges · forwards", icon: "◆", hot: true },
  { title: "Local Development Server", sub: "localhost:3000", icon: "▸" },
];

const steps = [
  ["01. Capture", "Receive webhook events through a dedicated public endpoint."],
  ["02. Inspect", "Examine headers, payloads and request history."],
  ["03. Forward & Replay", "Forward events to your local server and replay requests whenever needed."],
];

function Card({ label, title, text, children }: { label: string; title: React.ReactNode; text: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <div className="grid h-full gap-6 rounded-2xl border border-white/10 bg-[#121214] p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-center">
        <div>
          <Eyebrow>{label}</Eyebrow>
          <h3 className="font-display text-2xl font-semibold leading-snug text-white">{title}</h3>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">{text}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </Reveal>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className={`${wrap} pt-4`}>
        <header className="flex h-14 items-center justify-between rounded-2xl border border-white/10 bg-[#101012]/80 px-5 backdrop-blur">
          <Logo height={26} />
          <nav className="hidden items-center gap-9 text-sm text-zinc-400 md:flex">
            <a href="#product" className="transition hover:text-white">Product</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <Link href="/docs/" className="transition hover:text-white">Documentation</Link>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
          </nav>
          <div className="flex items-center gap-4 whitespace-nowrap text-sm">
            <Link href="/login/" className="hidden text-zinc-300 transition hover:text-white sm:inline">Sign in</Link>
            <Link href="/signup/" className="btn-glow rounded-full bg-brand px-4 py-1.5 text-[13px] font-semibold text-ink-950">Get started →</Link>
          </div>
        </header>
      </div>

      {/* ---------- hero ---------- */}
      <section id="product" className={`${wrap} grid items-center gap-12 pb-20 pt-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8 lg:pb-28 lg:pt-20`}>
        <div>
          <p className="rise mb-7 inline-block rounded-full border border-brand/40 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-brand" style={{ ["--d" as string]: "0ms" }}>
            Webhook inspection &amp; local tunnelling
          </p>
          <h1 className="rise font-display text-[2.8rem] font-semibold leading-[1.02] tracking-tight text-zinc-100 sm:text-6xl lg:text-[3.3rem] xl:text-[4rem]" style={{ ["--d" as string]: "80ms" }}>
            Every webhook.<br />Under your <span className="text-brand">control.</span>
          </h1>
          <p className="rise mt-5 font-display text-3xl font-medium text-zinc-400 sm:text-4xl" style={{ ["--d" as string]: "160ms" }}>
            Capture. Inspect. Replay.
          </p>
          <p className="rise mt-6 max-w-md text-base leading-relaxed text-zinc-300" style={{ ["--d" as string]: "240ms" }}>
            Inspect incoming requests, forward webhooks to your local environment, and replay events without disrupting your workflow.
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3" style={{ ["--d" as string]: "320ms" }}>
            <Link href="/signup/" className="btn-glow rounded-full bg-brand px-6 py-3 text-sm font-semibold text-ink-950">Get started →</Link>
            <a href="#features" className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-zinc-100 transition hover:border-white/40 hover:bg-white/5">Explore the product</a>
          </div>
          <p className="rise mt-6 text-sm text-zinc-500" style={{ ["--d" as string]: "400ms" }}>Built for developers. Designed for real workflows.</p>
        </div>

        <div className="rise relative" style={{ ["--d" as string]: "220ms" }}>
          <div className="pointer-events-none absolute -inset-8 -z-10 bg-[radial-gradient(closest-side,rgba(239,106,43,0.14),transparent)]" aria-hidden />
          <div className="[perspective:2000px]">
            <div className="transition-transform duration-700 ease-out lg:[transform:rotateY(-9deg)_rotateX(3deg)] lg:hover:[transform:rotateY(-2deg)_rotateX(0deg)]">
              <ProductShot />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className={`${wrap} pb-20 text-center lg:pb-28`}>
        <Reveal>
          <div className="flex justify-center"><Eyebrow>How it works</Eyebrow></div>
          <h2 className="font-display text-3xl font-semibold text-zinc-100 sm:text-4xl">From incoming request to local debugging.</h2>
          <div className="mx-auto mt-10 grid max-w-5xl items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {flow.flatMap((f, i) => {
              const box = (
                <div key={f.title} className={`flex items-center justify-center gap-3 rounded-xl border px-5 py-5 ${f.hot ? "border-brand/70 bg-brand/[0.04]" : "border-white/10 bg-[#121214]"}`}>
                  <span className={`text-2xl ${f.hot ? "text-brand" : "text-zinc-500"}`}>{f.icon}</span>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-zinc-100">{f.title}</div>
                    <div className="text-xs text-zinc-500">{f.sub}</div>
                  </div>
                </div>
              );
              return i < flow.length - 1 ? [box, <span key={`a${i}`} className="hidden text-2xl text-brand md:block">→</span>] : [box];
            })}
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-8 text-left md:grid-cols-3 md:gap-0 md:divide-x md:divide-white/10">
            {steps.map(([t, d]) => (
              <div key={t} className="md:px-8 md:first:pl-0 md:last:pr-0">
                <div className="font-semibold text-zinc-100">{t}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- features ---------- */}
      <section id="features" className={`${wrap} grid gap-5 pb-5 lg:grid-cols-2`}>
        <Card label="Request inspector" title={<>See exactly what<br />your application receives.</>} text="Dive into request headers, raw payloads and structured JSON data, with the exact bytes preserved for signature checks.">
          <MiniInspector />
        </Card>
        <Card label="Local tunnelling" title={<>Your local server.<br />Reachable from anywhere.</>} text="Expose your local development server through a secure public URL. The tunnel connects outbound, so no port forwarding.">
          <MiniTerminal>{`$ hooklens listen 3000

`}<span className="text-emerald-400">✓</span>{` Authenticated
`}<span className="text-emerald-400">✓</span>{` Tunnel connected
`}<span className="text-emerald-400">✓</span>{` Forwarding requests to
  localhost:3000

  https://your-host/hook/abc123`}</MiniTerminal>
        </Card>
        <Card label="Replay engine" title={<>Reproduce the request.<br />Debug with confidence.</>} text="Replay past webhook events anytime with a single click. No second test payment needed.">
          <MiniHistory title="Request history" rows={[
            { m: "POST", p: "/api/webhooks/payment", t: "2s ago", tag: "Replay" },
            { m: "GET", p: "/api/health", t: "12s ago" },
            { m: "POST", p: "/api/webhooks/github", t: "1m ago" },
          ]} />
        </Card>
        <Card label="Request history" title="Every event has a trace." text="Track, filter and search through your webhook history. Requests are captured even when your CLI is offline.">
          <MiniHistory title="Today" rows={[
            { m: "POST", p: "/api/webhooks/payment", t: "2s ago" },
            { m: "GET", p: "/api/health", t: "12s ago" },
            { m: "PUT", p: "/api/user", t: "1m ago" },
          ]} />
        </Card>
      </section>

      {/* ---------- developer experience ---------- */}
      <section className={`${wrap} pb-20 lg:pb-28`}>
        <Reveal>
          <div className="grid items-center gap-8 rounded-2xl border border-white/10 bg-[#121214] p-7 lg:grid-cols-2 lg:p-10">
            <MiniTerminal>{`$ hooklens login
$ hooklens listen 3000
`}<span className="text-emerald-400">✓</span>{` Authenticated
`}<span className="text-emerald-400">✓</span>{` Tunnel connected
`}<span className="text-emerald-400">✓</span>{` Forwarding requests to localhost:3000
$ `}<span className="animate-pulse">▌</span></MiniTerminal>
            <div>
              <Eyebrow>Developer experience</Eyebrow>
              <h2 className="font-display text-3xl font-semibold leading-tight text-zinc-100 sm:text-4xl">One command away from inspecting your next webhook.</h2>
              <p className="mt-4 max-w-md text-sm text-zinc-400">One static binary for macOS, Linux and Windows. No Node or Python needed.</p>
              <Link href="/signup/" className="btn-glow mt-7 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-ink-950">Start building with HookLens →</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- pricing ---------- */}
      <section id="pricing" className={`${wrap} pb-20 lg:pb-28`}>
        <Reveal>
          <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-[#121214] p-7 md:flex-row md:items-center md:justify-between lg:p-10">
            <div>
              <Eyebrow>Pricing</Eyebrow>
              <div className="font-display text-4xl font-semibold text-zinc-100">Free during the beta.</div>
              <p className="mt-2 text-sm text-zinc-400">10 endpoints · 5 simultaneous tunnels · 1 MB payloads · 7-day retention (up to 30). Paid plans may come later; nothing you create is taken away without notice.</p>
            </div>
            <Link href="/signup/" className="btn-glow shrink-0 rounded-full bg-brand px-6 py-3 text-center text-sm font-semibold text-ink-950">Create a free account →</Link>
          </div>
        </Reveal>
      </section>

      {/* ---------- final CTA ---------- */}
      <section className={`${wrap} pb-24 text-center`}>
        <Reveal>
          <div className="mx-auto mb-8 h-px w-24 bg-brand/70" />
          <h2 className="font-display text-3xl font-semibold text-zinc-100 sm:text-5xl">Stop guessing what your webhook sent.</h2>
          <p className="mt-3 text-lg text-zinc-400">Capture it. Understand it. Replay it.</p>
          <Link href="/signup/" className="btn-glow mt-8 inline-block rounded-full bg-brand px-7 py-3.5 text-sm font-semibold text-ink-950">Start building with HookLens →</Link>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-500`}>
          <div className="flex items-center gap-5">
            <Logo height={22} />
            <span className="hidden border-l border-white/10 pl-5 text-xs sm:inline">The developer tool for webhook inspection and tunnelling.</span>
          </div>
          <div className="flex gap-6">
            <a href="#product" className="hover:text-zinc-300">Product</a>
            <Link href="/docs/" className="hover:text-zinc-300">Documentation</Link>
            <Link href="/login/" className="hover:text-zinc-300">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
