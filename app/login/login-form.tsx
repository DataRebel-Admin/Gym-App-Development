"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "motion/react";
import {
  requestMagicLink,
  loginWithPassword,
  oauthSignIn,
  demoSignIn,
} from "./actions";
import type { LoginState } from "@/lib/login-types";
import type { DemoAccount } from "@/lib/demo-login";
import { PasskeyLoginButton } from "./passkey-login-button";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function LoginForm({
  tenant,
  oauth,
  demoAccounts,
}: {
  tenant: string;
  oauth?: { google: boolean; microsoft: boolean };
  demoAccounts?: DemoAccount[] | null;
}) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"password" | "link">("password");
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(requestMagicLink, {});
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(loginWithPassword, {});

  const hasSso = Boolean(oauth?.google || oauth?.microsoft);

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Passkey bovenaan — de snelste, biometrische route. Verbergt zichzelf als
          de browser geen WebAuthn ondersteunt. */}
      <PasskeyLoginButton />

      {/* SSO — alleen zichtbaar als geconfigureerd. */}
      {hasSso ? (
        <div className="flex flex-col gap-2.5">
          {oauth?.microsoft ? (
            <form action={oauthSignIn}>
              <input type="hidden" name="provider" value="microsoft-entra-id" />
              <input type="hidden" name="tenant" value={tenant} />
              <SsoButton label={t("continueMicrosoft")} icon={<MicrosoftIcon />} />
            </form>
          ) : null}
          {oauth?.google ? (
            <form action={oauthSignIn}>
              <input type="hidden" name="provider" value="google" />
              <input type="hidden" name="tenant" value={tenant} />
              <SsoButton label={t("continueGoogle")} icon={<GoogleIcon />} />
            </form>
          ) : null}

          <div className="flex items-center gap-3 py-1 text-xs font-medium text-neutral-400">
            <span className="h-px flex-1 bg-border" />
            {t("orWithEmail")}
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      ) : null}

      {/* Segmented control: wachtwoord (standaard, links) vs. magic link (rechts) */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
        <SegTab active={mode === "password"} onClick={() => setMode("password")}>
          {t("password")}
        </SegTab>
        <SegTab active={mode === "link"} onClick={() => setMode("link")}>
          {t("magicLink")}
        </SegTab>
      </div>

      {/* Eén formulier voor beide modi zodat de kaart niet in hoogte verspringt bij
          het wisselen. Het wachtwoordveld blijft altijd staan (reserveert ruimte),
          maar is bij magic link uitgeschakeld en niet vereist — je hoeft het dan niet
          in te vullen. Het e-mailadres blijft zo ook behouden tussen de tabs. */}
      <form
        action={mode === "password" ? pwAction : linkAction}
        className="flex w-full flex-col gap-4"
      >
        <input type="hidden" name="tenant" value={tenant} />
        <Field
          label={t("emailLabel")}
          error={mode === "password" ? pwState.error : linkState.error}
        >
          <Input name="email" type="email" required autoComplete="email" placeholder={t("emailPlaceholder")} className="py-3 text-base" />
        </Field>
        {/* Wachtwoordveld en de "geen wachtwoord nodig"-kaart delen één grid-cel →
            de kaarthoogte springt niet bij het wisselen. In magic-link-modus is het
            veld visueel wég (niet slechts grijs) zodat het glashelder is dat je hier
            niets hoeft in te vullen. Het input blijft in de DOM voor de wachtwoord-submit. */}
        <div className="grid">
          <div
            className={cn(
              "col-start-1 row-start-1 transition-opacity duration-200",
              mode === "password" ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            aria-hidden={mode !== "password"}
          >
            <Field label={t("passwordLabel")}>
              <Input
                name="password"
                type="password"
                required={mode === "password"}
                disabled={mode === "link"}
                autoComplete="current-password"
                className="py-3 text-base"
              />
            </Field>
            <div className="mt-1.5 text-right">
              <Link
                href="/login/reset"
                tabIndex={mode === "password" ? undefined : -1}
                className="text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800 focus-ring"
              >
                {t("forgotPassword")}
              </Link>
            </div>
          </div>
          <div
            className={cn(
              "col-start-1 row-start-1 flex items-center gap-3 self-end rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 transition-opacity duration-200",
              mode === "link" ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            aria-hidden={mode !== "link"}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
              <MagicLinkIcon />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-neutral-900">
                {t("noPasswordTitle")}
              </span>
              <span className="text-xs leading-snug text-neutral-500">
                {t("noPasswordBody")}
              </span>
            </span>
          </div>
        </div>
        <Button
          type="submit"
          size="lg"
          loading={mode === "password" ? pwPending : linkPending}
          className="mt-1 w-full"
        >
          {mode === "password"
            ? pwPending
              ? t("loggingIn")
              : t("login")
            : linkPending
              ? t("sending")
              : t("sendMagicLink")}
        </Button>
      </form>

      {demoAccounts && demoAccounts.length > 0 ? (
        <DemoPanel accounts={demoAccounts} />
      ) : null}
    </div>
  );
}

/**
 * Demo snel-inlog-paneel: een subtiele trigger die de accounts als zwevende
 * overlay uitklapt (zoals de taalwisselaar) — de kaart groeit dus niet mee.
 * Sluit bij klik-buiten en Escape.
 */
function DemoPanel({ accounts }: { accounts: DemoAccount[] }) {
  const t = useTranslations("auth");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-1 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="mx-auto flex items-center gap-1.5 text-[11px] font-medium text-neutral-400 transition-colors hover:text-neutral-600 focus-ring"
      >
        <WrenchIcon />
        {t("demoLogin")}
        <ChevronIcon open={open} />
      </button>

      <AnimatePresence>
        {open ? (
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 z-20 mb-2 flex max-h-72 w-full flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-surface-1 p-2 shadow-lg"
          >
            {accounts.map((a) => (
              <form key={`${a.tenant ?? "_"}:${a.email}`} action={demoSignIn}>
                <input type="hidden" name="email" value={a.email} />
                <input type="hidden" name="tenant" value={a.tenant ?? ""} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-0 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-100 focus-ring active:scale-[0.99]"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-neutral-800">{a.name}</span>
                    <span className="truncate text-[11px] text-neutral-400">{a.email}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-neutral-400">
                    <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-500">
                      {a.role}
                    </span>
                    {a.tenant ?? "platform"}
                  </span>
                </button>
              </form>
            ))}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-3 transition-transform", open && "rotate-180")}
      fill="none"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MagicLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
      <path
        d="M9.5 14.5l5-5M10 6l1-1a3.5 3.5 0 0 1 5 5l-1 1m-5 6l-1 1a3.5 3.5 0 0 1-5-5l1-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path
        d="M10.5 5.5a2.5 2.5 0 0 1-3.2 2.4L4 11.2a1.4 1.4 0 0 0 0 2l-.2-.2a1.4 1.4 0 0 0 2 0L9.1 9.7a2.5 2.5 0 0 0 3.3-3.1l-1.4 1.4-1.5-.4-.4-1.5 1.4-1.4a2.5 2.5 0 0 0-.5 1.3z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SegTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring",
        active
          ? "bg-surface-1 text-neutral-900 shadow-sm"
          : "text-neutral-500 hover:text-neutral-700"
      )}
    >
      {children}
    </button>
  );
}

function SsoButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border-strong bg-surface-1 px-4 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100 focus-ring active:scale-[0.99]"
    >
      <span className="flex size-5 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39 36 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}
