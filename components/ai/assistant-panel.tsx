"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles } from "@/components/ui/icons";
import type { AssistantProposal, AssistantResult } from "@/lib/ai/types";

export type ApplyResult = { ok?: boolean; error?: string };

type Msg = {
  role: "user" | "assistant";
  text: string;
  proposals?: AssistantProposal[];
};

export type AssistantPanelProps = {
  /** Server-action die een vraag beantwoordt (rol/context reeds gebonden). */
  ask: (question: string) => Promise<AssistantResult>;
  /** Optioneel: past een bevestigd voorstel toe via een bestaande, geaudite action. */
  onApply?: (proposal: AssistantProposal) => Promise<ApplyResult>;
  suggestions?: string[];
  intro?: string;
  placeholder?: string;
  /** Compacte hoogte voor de zwevende member-variant; ruimer inline (owner). */
  height?: "compact" | "tall";
};

/**
 * Herbruikbare conversatie-UI voor de AI Coach & Assistant. Contextloos van zichzelf:
 * de aanroeper injecteert een reeds-gebonden `ask` (en optioneel `onApply`) server-action.
 * Zo delen member-bubble, oefening-detail en ledenprofiel exact dezelfde UI.
 */
export function AssistantPanel({
  ask,
  onApply,
  suggestions = [],
  intro,
  placeholder = "Typ je vraag…",
  height = "compact",
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState<Record<string, ApplyResult & { pending?: boolean }>>({});
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToEnd() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }

  function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    startTransition(async () => {
      const res = await ask(q);
      setMessages((m) => [
        ...m,
        "error" in res
          ? { role: "assistant", text: res.error }
          : { role: "assistant", text: res.text, proposals: res.proposals },
      ]);
      scrollToEnd();
    });
  }

  function apply(proposal: AssistantProposal) {
    if (!onApply || applied[proposal.id]?.pending || applied[proposal.id]?.ok) return;
    setApplied((a) => ({ ...a, [proposal.id]: { pending: true } }));
    startTransition(async () => {
      const res = await onApply(proposal);
      setApplied((a) => ({ ...a, [proposal.id]: { ...res, pending: false } }));
    });
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <div
        ref={listRef}
        className={`flex flex-col gap-2 overflow-y-auto px-4 py-3 ${
          height === "tall" ? "max-h-96 min-h-40" : "max-h-72"
        }`}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            {intro ? <p className="text-sm text-neutral-500">{intro}</p> : null}
            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    disabled={pending}
                    className="rounded-full border border-border bg-surface-1 px-3 py-1.5 text-left text-xs text-neutral-700 transition hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "self-end bg-accent text-accent-foreground"
                    : "self-start bg-neutral-100 text-neutral-900"
                }`}
              >
                {m.text}
              </div>
              {m.proposals?.map((p) => (
                <div
                  key={p.id}
                  className="self-start w-full max-w-[95%] rounded-xl border border-accent/30 bg-accent-soft/40 p-3"
                >
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                    <Sparkles className="size-4 text-accent" />
                    {p.title}
                  </p>
                  {p.summary ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-600">
                      {p.summary}
                    </p>
                  ) : null}
                  {onApply ? (
                    applied[p.id]?.ok ? (
                      <p className="mt-2 text-xs font-medium text-green-700">
                        ✓ Toegepast
                      </p>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => apply(p)}
                          disabled={applied[p.id]?.pending}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                        >
                          {applied[p.id]?.pending
                            ? "Bezig…"
                            : p.applyLabel ?? "Toepassen"}
                        </button>
                        {applied[p.id]?.error ? (
                          <span className="text-xs text-red-600">
                            {applied[p.id]?.error}
                          </span>
                        ) : null}
                      </div>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          ))
        )}
        {pending ? (
          <div className="self-start rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-500">
            Aan het denken…
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={pending || !input.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          Stuur
        </button>
      </div>
    </div>
  );
}
