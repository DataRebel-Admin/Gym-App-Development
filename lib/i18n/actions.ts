"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { LOCALE_COOKIE } from "@/lib/constants";
import { enumFromLocale, isLocale, type AppLocale } from "@/lib/i18n/config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Zet de actieve UI-taal.
 *  1. Schrijft de `gymrebel-locale`-cookie (door request.ts gelezen bij de
 *     volgende render).
 *  2. Synchroniseert de persoonlijke voorkeur (`User.locale`) als de gebruiker
 *     is ingelogd, zodat de taal bij een volgende login bewaard blijft.
 *
 * Geen redirect/revalidate hier — de client roept `router.refresh()` aan voor
 * een directe RSC-re-render (geen full reload, state behouden).
 */
export async function setLocale(locale: AppLocale): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });

  const session = await auth();
  if (session?.user?.id) {
    // User-tabel is RLS-neutraal (zoals de auth-adapter) → base prisma op id.
    await prisma.user
      .update({
        where: { id: session.user.id },
        data: { locale: enumFromLocale(locale) },
      })
      .catch(() => {
        // Voorkeur opslaan mag de taalwissel nooit breken (best-effort).
      });
  }

  return { ok: true };
}
