"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote } from "@/components/ui";
import { Modal, Segmented } from "@/components/app";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api";

// Keep in sync with internal/server/feedback.go (the server enforces the same limits).
export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 1000;

type Category = "bug" | "idea" | "question" | "other";

const hints: Record<Category, string> = {
  bug: "What happened, and what did you expect to happen?",
  idea: "What would make HookLens more useful for you?",
  question: "What are you trying to do?",
  other: "Anything else you want us to know.",
};

export default function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const path = usePathname();
  const toast = useToast();
  const [category, setCategory] = useState<Category>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const len = [...message.trim()].length; // characters, not UTF-16 units, matching the server
  const tooShort = len < FEEDBACK_MIN;
  const nearLimit = len > FEEDBACK_MAX - 100;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tooShort || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("POST", "/api/v1/feedback", { category, message, page: path });
      setSent(true);
      toast("Thanks, your feedback was sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Modal title="Thank you" onClose={onClose}>
        <p className="text-sm leading-relaxed text-zinc-400">Your feedback reached us. We read every message, and it directly shapes what we build next.</p>
        <div className="mt-6 flex justify-end"><Button onClick={onClose}>Close</Button></div>
      </Modal>
    );
  }

  return (
    <Modal title="Send feedback" onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="mb-2 block text-[13px] font-medium text-zinc-300">What kind of feedback?</span>
          <Segmented<Category>
            value={category}
            onChange={setCategory}
            options={[
              { value: "bug", label: "Bug" },
              { value: "idea", label: "Idea" },
              { value: "question", label: "Question" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-zinc-300">
            Your message
            <span className={`text-xs font-normal tabular-nums ${nearLimit ? "text-amber-300" : "text-zinc-600"}`}>{len} / {FEEDBACK_MAX}</span>
          </span>
          <textarea
            autoFocus
            required
            rows={6}
            maxLength={FEEDBACK_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={hints[category]}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm leading-relaxed text-slate-100 transition placeholder:text-zinc-600 focus:border-brand/70 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <span className="mt-1.5 block text-xs text-zinc-600">
            {len === 0 ? `Between ${FEEDBACK_MIN} and ${FEEDBACK_MAX} characters.` : tooShort ? `${FEEDBACK_MIN - len} more character${FEEDBACK_MIN - len === 1 ? "" : "s"} needed.` : "Looks good."}
          </span>
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2.5 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={tooShort || busy}>{busy ? "Sending…" : "Send feedback"}</Button>
        </div>
      </form>
    </Modal>
  );
}
