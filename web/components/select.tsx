"use client";

import { Children, isValidElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck } from "@/components/icons";

type Opt = { value: string; label: string };

/** Reads <option value="x">Label</option> children so call sites keep the native-select API. */
function parseOptions(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const p = c.props as { value?: string | number; children?: React.ReactNode };
    const label = Children.toArray(p.children).join("");
    out.push({ value: p.value !== undefined ? String(p.value) : label, label });
  });
  return out;
}

type Pos = { left: number; width: number; top?: number; bottom?: number };

/**
 * Themed dropdown. The list is portalled to <body> with fixed positioning so tables and scroll
 * containers cannot clip it, and it flips upward when there is no room below.
 */
export function Select({ value, onChange, children, className = "" }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  const opts = parseOptions(children);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const byKeyboard = useRef(false);
  const current = opts.find((o) => o.value === value) ?? opts[0];

  function openMenu() {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const need = Math.min(opts.length * 38 + 14, 290);
    const below = window.innerHeight - r.bottom;
    setPos(below < need + 8 && r.top > below ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 } : { left: r.left, width: r.width, top: r.bottom + 6 });
    byKeyboard.current = true;
    setActive(Math.max(0, opts.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(o: Opt) {
    onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "scroll" && list.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  // Scroll the list itself (never the page) so the active row stays visible. Only for keyboard
  // navigation: scrolling on hover would fire page scroll events and close the menu mid-click.
  useEffect(() => {
    if (!open || !byKeyboard.current) return;
    const ul = list.current;
    const el = ul?.children[active] as HTMLElement | undefined;
    if (!ul || !el) return;
    if (el.offsetTop < ul.scrollTop) ul.scrollTop = el.offsetTop - 6;
    else if (el.offsetTop + el.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = el.offsetTop + el.offsetHeight - ul.clientHeight + 6;
  }, [open, active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); byKeyboard.current = true; setActive((a) => Math.min(a + 1, opts.length - 1)); break;
      case "ArrowUp": e.preventDefault(); byKeyboard.current = true; setActive((a) => Math.max(a - 1, 0)); break;
      case "Home": e.preventDefault(); byKeyboard.current = true; setActive(0); break;
      case "End": e.preventDefault(); byKeyboard.current = true; setActive(opts.length - 1); break;
      case "Enter":
      case " ": e.preventDefault(); if (opts[active]) choose(opts[active]); break;
      case "Escape": e.preventDefault(); setOpen(false); break;
      case "Tab": setOpen(false); break;
    }
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex h-9 items-center justify-between gap-2 rounded-lg border bg-black/30 px-3 text-left text-sm text-zinc-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${open ? "border-brand/60" : "border-white/10 hover:border-white/20"} ${className}`}
      >
        <span className="truncate">{current?.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[89]" onClick={() => setOpen(false)} />
            <ul
              ref={list}
              role="listbox"
              style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: Math.max(pos.width, 150) }}
              className="row-in z-[90] max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#18181b] p-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)]"
            >
              {opts.map((o, i) => {
                const selected = o.value === current?.value;
                return (
                  <li
                    key={o.value + i}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => { byKeyboard.current = false; setActive(i); }}
                    onClick={() => choose(o)}
                    className={`flex cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2 text-sm ${i === active ? "bg-white/[0.07]" : ""} ${selected ? "text-white" : "text-zinc-300"}`}
                  >
                    <span className="whitespace-nowrap">{o.label}</span>
                    {selected && <IconCheck className="h-4 w-4 text-brand" />}
                  </li>
                );
              })}
            </ul>
          </>,
          document.body,
        )}
    </>
  );
}
