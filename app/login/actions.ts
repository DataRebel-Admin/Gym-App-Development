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
  findLoginTenantsForEmail,
  matchPasswordAcrossTenants,
} from "@/lib/login-tenants";
import {
  parseLoginChallenge,
  mintTenantSelection,
  verifyTenantSelection,
} from "@/lib/login-challenge";
import { completePasswordLogin } from "@/lib/login-complete";
import type { LoginState } from "@/lib/login-types";
import {
  AUTH_TENANT_COOKIE,
  GYM_SELECT_COOKIE,
  TENANT_COOKIE_MAX_AGE,
  TWO_FACTOR_CHALLENGE_COOKIE,
} from "@/lib/constants";
import { demoLoginEnabled } from "@/lib/demo-login";

/** Duurzame tenant-context-cookie (subdomein-loos: de proxy valt hierop terug). */
const TENANT_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: TENANT_COOKIE_MAX_AGE,
} as const;

const requestSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
});

/**
 * Vraag een magic link aan. De sportschool wordt afgeleid uit het e-mailadres
 * (geen subdomein nodig): superadmin → globaal; één sportschool → die; meerdere →
 * `sendVerificationRequest` stuurt een gelabelde link per sportschool. Het scherm
 * toont altijd "check je mail" (geen enumeratie).
 */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = requestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const store = await cookies();

  // Platform-superadmin (geen tenant) → geen tenant-cookie; adapter zoekt globaal.
  const isSuperadmin = Boolean(
    await prisma.user.findFirst({
      where: { email, tenantId: null, role: "SUPERADMIN" },
      select: { id: true },
    })
  );
  if (isSuperadmin) {
    store.delete(AUTH_TENANT_COOKIE);
    try {
      await signIn("nodemailer", { email, redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) return { error: "Inloggen niet gelukt." };
      throw e;
    }
    return {};
  }

  const tenants = await findLoginTenantsForEmail(email);

  // Onbekend e-mailadres → toch "check je mail" tonen (geen enumeratie).
  if (tenants.length === 0) redirect("/login/check");

  // Zet de tenant-cookie op de eerste sportschool. Auth.js roept de signIn-gate
  // (getUserByEmail) óók bij het VERSTUREN aan — zonder cookie zou die niemand
  // vinden en de mail weigeren. Bij multi-gym overschrijft /login/magic de cookie
  // bij het klikken met de gekozen sportschool; de send-time waarde bepaalt de
  // uiteindelijke keuze dus niet.
  store.set(AUTH_TENANT_COOKIE, tenants[0].slug, TENANT_COOKIE_OPTS);

  if (tenants.length === 1) {
    // Nog niet geactiveerd (uitgenodigd, geen wachtwoord) → naar de activatieflow.
    const user = await resolveLoginUser(email);
    if (user && user.active && !user.passwordHash) {
      return {
        error:
          "Je account is nog niet geactiveerd. Gebruik de activatielink uit je uitnodigingsmail om een wachtwoord in te stellen.",
      };
    }
  }

  try {
    await signIn("nodemailer", { email, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Inloggen niet gelukt. Controleer je e-mailadres." };
    }
    throw e;
  }
  return {};
}

const pwLoginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord vereist"),
});

/**
 * Stap 1 van de wachtwoord-login (subdomein-loos). Het wachtwoord wordt gecheckt
 * tegen álle sportschool-accounts van dit e-mailadres:
 *  - 0 match → generieke fout;
 *  - 1 match → inloggen (of 2FA);
 *  - >1 match → gym-kiezer (`/login/gym`) met een proof-getekend keuze-token.
 * De kiezer verschijnt dus alleen ná een geldig wachtwoord → geen enumeratie.
 */
export async function loginWithPassword(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = pwLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const { password } = parsed.data;
  const store = await cookies();

  // 1) Platform-superadmin (globaal, geen tenant).
  const superadmin = await prisma.user.findFirst({
    where: { email, tenantId: null, role: "SUPERADMIN" },
  });
  if (superadmin) {
    store.delete(AUTH_TENANT_COOKIE);
    if (
      !superadmin.active ||
      !superadmin.passwordHash ||
      !(await verifyPassword(password, superadmin.passwordHash))
    ) {
      return { error: "Onjuiste inloggegevens." };
    }
    return completePasswordLogin({
      email: superadmin.email,
      tenantId: null,
      twoFactorEnabled: superadmin.twoFactorEnabled,
      twoFactorSecret: superadmin.twoFactorSecret,
    });
  }

  // 2) Tenant-accounts: wachtwoord checken over alle sportscholen van dit e-mailadres.
  const matched = await matchPasswordAcrossTenants(email, password);
  if (matched.length === 0) return { error: "Onjuiste inloggegevens." };

  if (matched.length === 1) {
    const acc = matched[0];
    store.set(AUTH_TENANT_COOKIE, acc.slug, TENANT_COOKIE_OPTS);
    return completePasswordLogin({
      email: acc.email,
      tenantId: acc.tenantId,
      twoFactorEnabled: acc.twoFactorEnabled,
      twoFactorSecret: acc.twoFactorSecret,
    });
  }

  // >1: gym-kiezer. Het proof-token draagt de reeds-geverifieerde tenant-ids.
  const token = mintTenantSelection({
    email,
    tenantIds: matched.map((m) => m.tenantId),
  });
  store.set(GYM_SELECT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  redirect("/login/gym");
}

/**
 * Kies een sportschool ná een geldige wachtwoord-check (multi-gym). Het
 * keuze-token bewijst dat het wachtwoord voor deze tenant-ids klopte, dus we
 * hoeven het niet opnieuw te vragen.
 */
export async function selectGym(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const store = await cookies();
  const token = store.get(GYM_SELECT_COOKIE)?.value;
  const claims = token ? verifyTenantSelection(token) : null;
  if (!slug || !claims) redirect("/login");

  const tenant = await prisma.tenant.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant || !claims.tenantIds.includes(tenant.id)) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: claims.email } },
    select: { active: true, twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!user || !user.active) redirect("/login");

  store.set(AUTH_TENANT_COOKIE, tenant.slug, TENANT_COOKIE_OPTS);
  store.delete(GYM_SELECT_COOKIE);

  const res = await completePasswordLogin({
    email: claims.email,
    tenantId: tenant.id,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorSecret: user.twoFactorSecret,
  });
  // completePasswordLogin gooit een redirect bij succes/2FA; hier belanden we
  // alleen bij een onverwachte fout → terug naar de login.
  if (res?.error) redirect("/login");
}

const twoFactorSchema = z.object({
  code: z.string().trim().min(1, "Voer je 2FA-code in"),
});

/**
 * Stap 2 van de wachtwoord-login: verifieer de 2FA-code tegen de challenge uit
 * stap 1. De `authorize`-callback valideert challenge-handtekening én TOTP-code.
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
    throw e;
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
    (await cookies()).set(AUTH_TENANT_COOKIE, tenant, TENANT_COOKIE_OPTS);
  }
  await signIn(provider, { redirectTo: "/" });
}

/**
 * Demo-login: log direct in als een demo-account, zonder wachtwoord of magic
 * link. Uitsluitend actief wanneer DEMO_LOGIN="true" (zie demoLoginEnabled).
 */
export async function demoSignIn(formData: FormData) {
  if (!demoLoginEnabled()) return;
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const tenant = String(formData.get("tenant") ?? "");
  if (!email) return;

  const store = await cookies();
  if (tenant) {
    store.set(AUTH_TENANT_COOKIE, tenant, TENANT_COOKIE_OPTS);
  } else {
    // Geen tenant → platform-superadmin (resolveLoginUser zoekt tenantId == null).
    store.delete(AUTH_TENANT_COOKIE);
  }

  try {
    await signIn("demo-login", { email, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/login?devError=1");
    throw e;
  }
}

/** Log de huidige gebruiker uit en stuur terug naar de loginpagina. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
  redirect("/login");
}
