"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { beginAuthentication, finishAuthentication } from "@/lib/passkey";
import { completePasswordLogin } from "@/lib/login-complete";
import type { LoginState } from "@/lib/login-types";
import { AUTH_TENANT_COOKIE, TENANT_COOKIE_MAX_AGE } from "@/lib/constants";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";

/** Start passkey-login (usernameless/discoverable — opties → client). */
export async function startPasskeyLogin(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return beginAuthentication();
}

/**
 * Rond passkey-login af. De credential resolvet exact één User (met tenant), dus
 * er is geen subdomein of gym-kiezer nodig. Bij succes wordt de sessie gemint via
 * de bestaande credentials+challenge-engine (completePasswordLogin) — die gooit
 * een redirect (of naar /login/2fa als het account óók TOTP-2FA heeft).
 */
export async function finishPasskeyLogin(
  response: AuthenticationResponseJSON
): Promise<LoginState> {
  const record = await prisma.authenticator.findUnique({
    where: { credentialId: response.id },
    select: {
      id: true,
      credentialId: true,
      publicKey: true,
      counter: true,
      transports: true,
      user: {
        select: {
          email: true,
          role: true,
          tenantId: true,
          active: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          tenant: { select: { slug: true, status: true, deletedAt: true } },
        },
      },
    },
  });

  const generic = { error: "Toegangssleutel niet herkend." };
  if (!record || !record.user.active) return generic;
  const u = record.user;

  // Tenant-gebruiker: tenant moet actief zijn. Superadmin (tenantId null) mag.
  if (u.tenantId && (!u.tenant || u.tenant.status !== "ACTIVE" || u.tenant.deletedAt)) {
    return generic;
  }

  const verified = await finishAuthentication(response, {
    credentialId: record.credentialId,
    publicKey: record.publicKey,
    counter: record.counter,
    transports: record.transports,
  });
  if (!verified) return { error: "Verificatie van de toegangssleutel is mislukt." };

  await prisma.authenticator.update({
    where: { id: record.id },
    data: { counter: verified.newCounter, lastUsedAt: new Date() },
  });

  // Tenant-context zetten (of wissen voor superadmin) → sessie minten.
  const store = await cookies();
  if (u.tenantId && u.tenant) {
    store.set(AUTH_TENANT_COOKIE, u.tenant.slug, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: TENANT_COOKIE_MAX_AGE,
    });
  } else {
    store.delete(AUTH_TENANT_COOKIE);
  }

  return completePasswordLogin({
    email: u.email,
    tenantId: u.tenantId,
    twoFactorEnabled: u.twoFactorEnabled,
    twoFactorSecret: u.twoFactorSecret,
  });
}
