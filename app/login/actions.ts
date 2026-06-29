"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
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

  // Onthoud de tenant voor de verificatiestap (phase 2 van de magic link).
  const store = await cookies();
  store.set(AUTH_TENANT_COOKIE, tenant, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15, // 15 minuten
  });

  // signIn stuurt de magic link (console in dev) en redirect naar verifyRequest.
  await signIn("nodemailer", {
    email,
    redirectTo: "/",
  });

  // Onbereikbaar (signIn redirect), maar bevredigt het type.
  return {};
}

/** Log de huidige gebruiker uit en stuur terug naar de loginpagina. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
  redirect("/login");
}
