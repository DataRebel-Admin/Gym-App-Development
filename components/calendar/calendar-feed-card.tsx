"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { CalendarDays, Check, ChevronDown } from "@/components/ui/icons";
import {
  createCalendarFeed,
  revokeCalendarFeed,
  rotateCalendarFeed,
} from "@/app/member/agenda/actions";

/**
 * Agendakoppeling (ICS-feed): aanmaken en daarna zo automatisch mogelijk
 * koppelen — één tik per provider (webcal:// voor Apple, de "toevoegen via
 * URL"-deeplinks van Google Agenda en Outlook). Kopieerknoppen en handmatige
 * stappen blijven als terugval in een uitklapblok. Vernieuwen/intrekken vraagt
 * een tweede tik als bevestiging (armed-state, geen modal nodig). De uitleg is
 * bewust eerlijk: providers verversen elke paar uur, en het lid deelt hiermee
 * z'n trainingsdata met z'n eigen kalenderprovider.
 */
export function CalendarFeedCard({
  feedUrl,
  calendarName,
}: {
  feedUrl: string | null;
  calendarName: string | null;
}) {
  const t = useTranslations("member.agenda");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<"https" | "webcal" | null>(null);
  const [armed, setArmed] = useState<"rotate" | "revoke" | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (armTimer.current) clearTimeout(armTimer.current);
  }, []);

  const webcalUrl = feedUrl ? feedUrl.replace(/^https?:\/\//, "webcal://") : null;
  const googleUrl = webcalUrl
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`
    : null;
  const outlookUrl = feedUrl
    ? `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(
        feedUrl
      )}&name=${encodeURIComponent(calendarName ?? "Agenda")}`
    : null;

  async function copy(text: string, which: "https" | "webcal") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Terugval (oudere WebViews): tijdelijke textarea + execCommand.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(which);
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
  }

  function run(action: () => Promise<{ ok: boolean }>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  function confirmable(kind: "rotate" | "revoke", action: () => Promise<{ ok: boolean }>) {
    if (armed !== kind) {
      setArmed(kind);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(null), 4000);
      return;
    }
    setArmed(null);
    run(action);
  }

  if (feedUrl === null) {
    return (
      <div className="rounded-3xl border border-border bg-surface-1 p-4 shadow-sm">
        <p className="text-xs text-neutral-500">{t("feedPrivacyNotice")}</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(createCalendarFeed)}
          className="mt-3 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground active:opacity-90 disabled:opacity-60"
        >
          {t("feedCreate")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-surface-1 p-4 shadow-sm">
      {/* Eén tik per provider — de link opent direct het abonneer-scherm. */}
      <div className="flex flex-col gap-2">
        <a
          href={webcalUrl ?? "#"}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground active:opacity-90"
        >
          <CalendarDays className="size-4" /> {t("feedAddApple")}
        </a>
        <a
          href={googleUrl ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-accent px-4 py-2.5 text-sm font-bold text-accent active:bg-surface-2"
        >
          <CalendarDays className="size-4" /> {t("feedAddGoogle")}
        </a>
        <a
          href={outlookUrl ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-accent px-4 py-2.5 text-sm font-bold text-accent active:bg-surface-2"
        >
          <CalendarDays className="size-4" /> {t("feedAddOutlook")}
        </a>
      </div>

      {/* Handmatige terugval: links kopiëren + stappen per provider. */}
      <details className="group mt-3 rounded-xl border border-border px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-neutral-700">
          {t("feedManualTitle")}
          <ChevronDown className="size-4 text-neutral-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {([
            ["https", t("feedUrlLabel"), feedUrl],
            ["webcal", t("feedWebcalLabel"), webcalUrl ?? ""],
          ] as const).map(([which, label, url]) => (
            <div key={which}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                {label}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] text-neutral-600">
                  {url}
                </code>
                <button
                  type="button"
                  onClick={() => copy(url, which)}
                  className={cn(
                    "shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold",
                    copied === which
                      ? "border-accent text-accent"
                      : "border-border text-neutral-600 active:bg-surface-2"
                  )}
                >
                  {copied === which ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="size-3" /> {t("feedCopied")}
                    </span>
                  ) : (
                    t("feedCopy")
                  )}
                </button>
              </div>
            </div>
          ))}
          <ul className="mt-1 flex flex-col gap-1.5 text-xs text-neutral-500">
            <li>
              <span className="font-semibold text-neutral-600">{t("feedProviderGoogle")}: </span>
              {t("feedGoogleSteps")}
            </li>
            <li>
              <span className="font-semibold text-neutral-600">{t("feedProviderOutlook")}: </span>
              {t("feedOutlookSteps")}
            </li>
            <li>
              <span className="font-semibold text-neutral-600">{t("feedProviderApple")}: </span>
              {t("feedAppleSteps")}
            </li>
          </ul>
        </div>
      </details>

      <p className="mt-3 text-[11px] text-neutral-400">{t("feedRefreshNotice")}</p>
      <p className="mt-1 text-[11px] text-neutral-400">{t("feedPrivacyNotice")}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => confirmable("rotate", rotateCalendarFeed)}
          className={cn(
            "rounded-xl border px-3 py-2.5 text-xs font-semibold disabled:opacity-60",
            armed === "rotate"
              ? "border-accent text-accent"
              : "border-border text-neutral-600 active:bg-surface-2"
          )}
        >
          {armed === "rotate" ? t("feedConfirm") : t("feedRotate")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => confirmable("revoke", revokeCalendarFeed)}
          className={cn(
            "rounded-xl border px-3 py-2.5 text-xs font-semibold disabled:opacity-60",
            armed === "revoke"
              ? "border-red-400 text-red-600"
              : "border-border text-neutral-600 active:bg-surface-2"
          )}
        >
          {armed === "revoke" ? t("feedConfirm") : t("feedRevoke")}
        </button>
      </div>
    </div>
  );
}
