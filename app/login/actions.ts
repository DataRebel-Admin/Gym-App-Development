"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/security";
import { resolveLoginUser } from "@/lib/login-user";
import {
  mintLoginChallenge,
  parseLoginChallenge,
} from "@/lib/login-challenge";
import {
  AUTH_TENANT_COOKIE,
  DEV_FALLBACK_TENANT,
  TWO_FACTOR_CHALLENGE_COOKIE,
} from "@/lib/constants";
import { demoLoginEnabled } from "@/lib/demo-login";

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

const pwLoginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord vereist"),
  tenant: z.string().min(1).default(DEV_FALLBACK_TENANT),
});

/**
 * Stap 1 van de wachtwoord-login: verifieer e-mail + wachtwoord. Heeft de
 * gebruiker 2FA ingeschakeld, dan vragen we de code NIET hier maar sturen we
 * door naar de aparte verificatiepagina (`/login/2fa`). Een ondertekende
 * challenge (cookie) draagt het bewijs van de wachtwoordcheck mee, zodat stap 2
 * alleen de code hoeft te verzamelen. Zonder 2FA loggen we meteen in.
 */
export async function loginWithPassword(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = pwLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    tenant: formData.get("tenant"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { email, password, tenant } = parsed.data;

  const isSuperadmin = Boolean(
    await prisma.user.findFirst({
      where: { email, tenantId: null, role: "SUPERADMIN" },
      select: { id: true },
    })
  );
  const store = await cookies();
  if (isSuperadmin) store.delete(AUTH_TENANT_COOKIE);
  else
    store.set(AUTH_TENANT_COOKIE, tenant, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

  // Verifieer wachtwoord vóór we eventueel om 2FA vragen (geen enumeration:
  // dezelfde generieke fout bij onbekende gebruiker én verkeerd wachtwoord).
  const user = await resolveLoginUser(email);
  if (
    !user ||
    !user.active ||
    !user.passwordHash ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    return { error: "Onjuiste inloggegevens." };
  }

  const challenge = mintLoginChallenge({ email: user.email, tenantId: user.tenantId });

  // 2FA aan → naar de aparte verificatiepagina, met de challenge in een cookie.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    store.set(TWO_FACTOR_CHALLENGE_COOKIE, challenge, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 5,
    });
    redirect("/login/2fa");
  }

  // Geen 2FA → meteen inloggen; de challenge bewijst de wachtwoordcheck.
  try {
    await signIn("credentials", { email: user.email, challenge, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Inloggen niet gelukt." };
    }
    throw e; // NEXT_REDIRECT bij succes
  }
  return {};
}

const twoFactorSchema = z.object({
  code: z.string().trim().min(1, "Voer je 2FA-code in"),
});

/**
 * Stap 2 van de wachtwoord-login: verifieer de 2FA-code tegen de challenge die
 * in stap 1 is gezet. De `authorize`-callback valideert de challenge-handtekening
 * én de TOTP-code; het wachtwoord komt hier niet meer aan te pas.
 */
export async function verifyTwoFactor(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = twoFactorSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige code" };
  }
  const { code } = parsed.data;

  const challenge = (await cookies()).get(TWO_FACTOR_CHALLENGE_COOKIE)?.value;
  const claims = challenge ? parseLoginChallenge(challenge) : null;
  if (!challenge || !claims) {
    return { error: "Je sessie is verlopen. Log opnieuw in." };
  }

  try {
    await signIn("credentials", {
      email: claims.email,
      challenge,
      code,
      redirectTo: "/",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Ongeldige of verlopen 2FA-code." };
    }
    throw e; // NEXT_REDIRECT bij succes
  }
  return {};
}

/** Start OAuth-login (Microsoft Entra of Google). Zet de tenant-cookie zodat de
 *  adapter na de callback het juiste tenant-account koppelt. */
export async function oauthSignIn(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  const tenant = String(formData.get("tenant") ?? "");
  if (provider !== "google" && provider !== "microsoft-entra-id") return;
  if (tenant) {
    (await cookies()).set(AUTH_TENANT_COOKIE, tenant, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });
  }
  await signIn(provider, { redirectTo: "/" });
}

/**
 * Demo-login: log direct in als een demo-account, zonder wachtwoord of magic
 * link. Uitsluitend actief wanneer DEMO_LOGIN="true" (ook in productie — zie
 * demoLoginEnabled). Zet de tenant-cookie zodat de tenant-scoped resolutie
 * (en de signIn-callback) het juiste account vinden — net als de OAuth-flow.
 */
export async function demoSignIn(formData: FormData) {
  if (!demoLoginEnabled()) return;
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const tenant = String(formData.get("tenant") ?? "");
  if (!email) return;

  const store = await cookies();
  if (tenant) {
    store.set(AUTH_TENANT_COOKIE, tenant, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });
  } else {
    // Geen tenant → platform-superadmin (resolveLoginUser zoekt tenantId == null).
    store.delete(AUTH_TENANT_COOKIE);
  }

  try {
    await signIn("demo-login", { email, redirectTo: "/" });
  } catch (e) {
    // Mislukte demo-login (bv. seed niet gedraaid) → netjes terug naar /login.
    if (e instanceof AuthError) redirect("/login?devError=1");
    throw e; // NEXT_REDIRECT bij succes
  }
}

/** Log de huidige gebruiker uit en stuur terug naar de loginpagina. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
  redirect("/login");
}
