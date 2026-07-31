import Link from "next/link";
import type { ReactNode } from "react";
import { GymRebelLogo } from "@/components/brand/gymrebel-logo";

/**
 * Shell voor de publieke informatiepagina's (/privacy, /cookies, /support).
 *
 * Bewust **buiten** de tenant-huisstijl: deze pagina's komen van GymRebel als
 * aanbieder, niet van een individuele sportschool. Daarom het platformmerk, net
 * als op de pre-tenant landingspagina en de foutpagina's.
 *
 * Ook bewust publiek (geen login): App Store Connect en Google Play Console
 * eisen allebei een privacy-URL én een support-URL die een reviewer zónder
 * account kan openen. Staat zo'n pagina achter een inlogscherm, dan wordt de app
 * afgekeurd.
 */
export function InfoPage({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string;
  /** ISO-datum (YYYY-MM-DD) van de laatste inhoudelijke wijziging. Weglaten mag. */
  updatedAt?: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const formatted = updatedAt
    ? new Intl.DateTimeFormat("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(updatedAt))
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
      <Link href="/" className="inline-block">
        <GymRebelLogo className="h-9 w-auto text-neutral-900" />
        <span className="sr-only">GymRebel</span>
      </Link>

      <h1 className="mt-10 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
        {title}
      </h1>
      {formatted ? (
        <p className="mt-2 text-sm text-neutral-500">Laatst bijgewerkt op {formatted}</p>
      ) : null}

      <div className="mt-8 flex flex-col gap-5 text-[15px] leading-relaxed text-neutral-600">
        {intro}
      </div>

      <div className="mt-10 flex flex-col gap-10">{children}</div>

      <nav className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm text-neutral-500">
        <Link href="/support" className="hover:text-neutral-900">
          Hulp nodig
        </Link>
        <Link href="/privacy" className="hover:text-neutral-900">
          Privacyverklaring
        </Link>
        <Link href="/cookies" className="hover:text-neutral-900">
          Cookiebeleid
        </Link>
        <Link href="/" className="hover:text-neutral-900">
          Naar de app
        </Link>
      </nav>
    </main>
  );
}

/** Sectie met kop en anker, zodat er vanuit de tekst naar verwezen kan worden. */
export function InfoSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-semibold text-neutral-900">{heading}</h2>
      <div className="mt-3 flex flex-col gap-4 text-[15px] leading-relaxed text-neutral-600">
        {children}
      </div>
    </section>
  );
}
