"use client";

import { useRef, useState, useTransition } from "react";
import { askAssistant } from "@/app/member/assistant-actions";

type Msg = { role: "user" | "assistant"; text: string };

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  function send() {
    const q = input.trim();
    if (!q || pending) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    startTransition(async () => {
      const res = await askAssistant(q);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: res.answer ?? res.error ?? "Geen antwoord." },
      ]);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    });
  }

  return (
    <>
      {/* Chat-bubble rechtsonder */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open de trainingsassistent"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-foreground shadow-lg active:opacity-90"
      >
        {open ? "✕" : "💬"}
      </button>

      {open ? (
        <div className="fixed inset-x-4 bottom-40 z-40 mx-auto flex max-w-md flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-200 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">
              Trainingsassistent
            </p>
            <p className="text-xs text-neutral-500">
              Geen medisch advies — bij twijfel: vraag een trainer.
            </p>
          </div>

          <div
            ref={listRef}
            className="flex max-h-72 flex-col gap-2 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Stel een vraag over je schema of de apparatuur.
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "self-end bg-accent text-accent-foreground"
                      : "self-start bg-neutral-100 text-neutral-900"
                  }`}
                >
                  {m.text}
                </div>
              ))
            )}
            {pending ? (
              <div className="self-start rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-500">
                Aan het denken…
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 border-t border-neutral-200 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Typ je vraag…"
              className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={send}
              disabled={pending || !input.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              Stuur
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
