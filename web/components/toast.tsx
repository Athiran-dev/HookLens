"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { IconCheck, IconX } from "@/components/icons";

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="row-in pointer-events-auto flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#18181b] px-4 py-3 text-sm text-zinc-100 shadow-2xl">
            {t.tone === "ok" ? <IconCheck className="text-emerald-400" /> : <IconX className="text-red-400" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
