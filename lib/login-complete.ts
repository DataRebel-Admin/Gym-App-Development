import "server-only";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { mintLoginChallenge } from "@/lib/login-challenge";
import { TWO_FACTOR_CHALLENGE_COOKIE } from "@/lib/constants";
import type { LoginState } from "@/lib/login-types";

/**
 * Rond een reeds geverifieerde login af (wachtwoord, gym-kiezer óf passkey): mint
 * de credentials-challenge en stuur door naar 2FA (indien actief) of log direct in.
 *
 * **Belangrijk**: dit is een server-only helper, GEEN server-action — het zou
 * anders een endpoint zijn waarmee je als willekeurig account kunt inloggen. De
 * AUTH_TENANT_COOKIE moet vóór de aanroep al op de juiste sportschool staan
 * (de credentials-`authorize` leest die).
 */
export async function completePasswordLogin(account: {
  email: string;
  tenantId: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
}): Promise<LoginState> {
  const challenge = mintLoginChallenge({
    email: account.email,
    tenantId: account.tenantId,
  });

  if (account.twoFactorEnabled && account.twoFactorSecret) {
    (await cookies()).set(TWO_FACTOR_CHALLENGE_COOKIE, challenge, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 5,
    });
    redirect("/login/2fa");
  }

  try {
    await signIn("credentials", { email: account.email, challenge, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Inloggen niet gelukt." };
    throw e; // NEXT_REDIRECT bij succes
  }
  return {};
}
