import { JsonView } from "@/components/fx";
import { MethodBadge } from "@/components/ui";

/** Small orange dash + uppercase label used above section headings. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
      <span className="h-px w-5 bg-brand" /> {children}
    </div>
  );
}

function Dots() {
  return (
    <span className="flex gap-1.5">
      <i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
      <i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
      <i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
    </span>
  );
}

export function Window({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0f] ${className}`}>
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <Dots />
        {title && <span className="text-xs text-zinc-500">{title}</span>}
      </div>
      {children}
    </div>
  );
}

const ROWS = [
  { m: "POST", p: "/api/webhooks/payment", t: "2s ago", sel: true },
  { m: "GET", p: "/api/health", t: "12s ago" },
  { m: "PUT", p: "/api/user", t: "1m ago" },
  { m: "POST", p: "/api/webhooks/github", t: "2m ago" },
  { m: "GET", p: "/api/stats", t: "3m ago" },
  { m: "POST", p: "/api/webhooks/stripe", t: "5m ago" },
  { m: "DELETE", p: "/api/session", t: "8m ago" },
];

const SAMPLE_BODY = JSON.stringify({ event: "payment.success", amount: 4999, currency: "INR", status: "completed" }, null, 2);

/** An illustration of the dashboard (sample data) used in the hero. */
export function ProductShot() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0f] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <Dots />
        <span className="ml-1 text-[11px] text-zinc-600">sample data</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[10.5rem_minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* sidebar */}
        <aside className="hidden border-r border-white/[0.06] p-3 text-xs text-zinc-400 sm:block">
          <div className="mb-4 flex items-center gap-2 font-semibold text-white">
            <img src="/mark-white.png" alt="" className="h-4 w-auto" /> HOOKLENS
          </div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">Endpoints</div>
          {["/webhooks/github", "/webhooks/stripe", "/api/events"].map((e, i) => (
            <div key={e} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${i === 0 ? "bg-white/[0.06] text-white" : ""}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${i === 1 ? "bg-brand" : "bg-zinc-600"}`} />
              <span className="truncate font-mono text-[11px]">{e}</span>
            </div>
          ))}
          <div className="mt-6 flex items-center gap-2 rounded-md border border-white/[0.06] px-2 py-2">
            <span className="live-dot" />
            <div>
              <div className="text-[11px] text-white">Tunnel active</div>
              <div className="font-mono text-[10px] text-zinc-500">localhost:3000</div>
            </div>
          </div>
        </aside>
        {/* request list */}
        <div className="p-3 sm:border-r sm:border-white/[0.06]">
          <div className="mb-3 flex items-center justify-between rounded-md border border-white/[0.06] px-2.5 py-1.5 text-[11px] text-zinc-500">
            <span>Search requests…</span>
            <span className="flex items-center gap-1.5 text-emerald-400"><span className="live-dot" /> Live</span>
          </div>
          <ul className="space-y-1">
            {ROWS.map((r) => (
              <li key={r.p} className={`flex items-center gap-2 rounded-md px-2 py-2.5 text-[11px] ${r.sel ? "bg-white/[0.07]" : ""}`}>
                <MethodBadge method={r.m} />
                <span className="min-w-0 flex-1 truncate font-mono text-zinc-200">{r.p}</span>
                <span className="text-zinc-600">{r.t}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* detail */}
        <div className="hidden p-3 sm:block">
          <div className="mb-3 flex items-center justify-between">
            <span className="truncate font-mono text-[11px] text-white"><b className="text-brand">POST</b> /api/webhooks/payment</span>
            <span className="shrink-0 whitespace-nowrap rounded bg-brand px-2 py-0.5 text-[10px] font-semibold text-ink-950">↻ Replay</span>
          </div>
          <div className="mb-2 flex gap-3 border-b border-white/[0.06] pb-2 text-[11px] text-zinc-500">
            <span>Headers</span><span className="border-b border-brand text-white">Body</span><span>Response</span>
          </div>
          <JsonView text={SAMPLE_BODY} className="!max-h-56 !whitespace-pre !break-normal !p-3 !text-[11px]" />
        </div>
      </div>
    </div>
  );
}

/** Mini UI: request headers/body tabs. */
export function MiniInspector() {
  return (
    <Window>
      <div className="p-4">
        <div className="mb-3 flex gap-4 text-xs text-zinc-500">
          <span>Headers</span><span className="border-b border-brand pb-1 text-white">Body</span><span>Response</span>
        </div>
        <JsonView text={JSON.stringify({ event: "invoice.paid", amount: 4999, status: "success" }, null, 2)} className="!whitespace-pre !break-normal !p-3 !text-[11.5px]" />
      </div>
    </Window>
  );
}

export function MiniTerminal({ children }: { children: React.ReactNode }) {
  return (
    <Window>
      <pre className="p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200">{children}</pre>
    </Window>
  );
}

export function MiniHistory({ title, rows }: { title: string; rows: { m: string; p: string; t: string; tag?: string }[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d0f]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 text-xs">
        <span className="font-semibold text-white">{title}</span>
        <span className="text-zinc-600">sample data</span>
      </div>
      <ul className="space-y-0.5 p-2">
        {rows.map((r) => (
          <li key={r.p} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-xs">
            <MethodBadge method={r.m} />
            <span className="min-w-0 flex-1 truncate font-mono text-zinc-300">{r.p}</span>
            {r.tag && <span className="rounded bg-brand px-2 py-0.5 text-[10px] font-semibold text-ink-950">{r.tag}</span>}
            <span className="text-zinc-600">{r.t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
