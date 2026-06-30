"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { AUTH_TENANT_COOKIE, DEV_FALLBACK_TENANT } from "@/lib/constants";

const requestSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  tenant: z.string().min(1).default(DEV_FALLBACK_TENANT),
});

export type LoginState = { error?: string };

/**
 * Vraag een magic link aan voor het opgegeven e-mailadres, gescoped op de
 * tenant uit het formulier. De tenant-slug wordt in een cookie gezet zodat de
 * tenant-scoped adapter de juiste sportschool kiest bij het verifiëren.
 */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = requestSchema.safeParse({
    email: formData.get("email"),
    tenant: formData.get("tenant"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }

  const { email, tenant } = parsed.data;

  // Platform-superadmins hebben geen tenant. Detecteer ze zodat we GEEN
  // tenant-cookie zetten — dan doet de adapter de globale superadmin-lookup
  // (zie lib/auth-adapter.ts). Tenant-gebruikers krijgen wél de tenant-cookie.
  const isSuperadmin = Boolean(
    await prisma.user.findFirst({
      where: { email, tenantId: null, role: "SUPERADMIN" },
      select: { id: true },
    })
  );

  const store = await cookies();
  if (isSuperadmin) {
    store.delete(AUTH_TENANT_COOKIE);
  } else {
    // Onthoud de tenant voor de verificatiestap (phase 2 van de magic link).
    store.set(AUTH_TENANT_COOKIE, tenant, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15, // 15 minuten
    });
  }

  // signIn verstuurt de magic link (console in dev). Bij succes gooit het een
  // redirect (naar de verifyRequest-pagina) die we moeten doorgooien; bij een
  // weigering gooit het een AuthError die we hier netjes afvangen i.p.v. crashen.
  try {
    await signIn("nodemailer", { email, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) {
      return {
        error:
          "Inloggen niet gelukt. Controleer je e-mailadres (en of je bij deze sportschool hoort).",
      };
    }
    throw e; // NEXT_REDIRECT (succes) of een andere fout
  }

  // Onbereikbaar (signIn redirect bij succes), maar bevredigt het type.
  return {};
}

/** Log de huidige gebruiker uit en stuur terug naar de loginpagina. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
  redirect("/login");
}
