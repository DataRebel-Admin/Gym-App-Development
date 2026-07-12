"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/account";
import { beginRegistration, finishRegistration } from "@/lib/passkey";
import { audit } from "@/lib/audit";
import type {
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/types";

/** Start de passkey-registratie voor de ingelogde gebruiker (opties → client). */
export async function startPasskeyRegistration(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const user = await requireAccount();
  const existing = await prisma.authenticator.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  });
  return beginRegistration(
    { id: user.id, email: user.email ?? "", name: user.name },
    existing
  );
}

/** Rond de passkey-registratie af: verifieer + sla op (gebonden aan de ingelogde user). */
export async function finishPasskeyRegistration(input: {
  response: RegistrationResponseJSON;
  name?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAccount();
  const cred = await finishRegistration(user.id, input.response);
  if (!cred) {
    return { ok: false, error: "Kon de toegangssleutel niet verifiëren. Probeer het opnieuw." };
  }

  try {
    await prisma.authenticator.create({
      data: {
        userId: user.id,
        credentialId: cred.credentialId,
        publicKey: cred.publicKey,
        counter: cred.counter,
        transports: cred.transports,
        deviceType: cred.deviceType,
        backedUp: cred.backedUp,
        name: input.name?.trim().slice(0, 60) || null,
      },
    });
  } catch {
    // @unique(credentialId) → al geregistreerd op dit (of een ander) account.
    return { ok: false, error: "Deze toegangssleutel is al geregistreerd." };
  }

  await audit("passkey.add", {
    actor: { id: user.id, email: user.email, role: user.role },
    tenantId: user.tenantId,
    targetType: "User",
    targetId: user.id,
  });
  revalidatePath("/account/beveiliging");
  return { ok: true };
}

/** Verwijder een eigen passkey. */
export async function removePasskey(id: string): Promise<void> {
  const user = await requireAccount();
  const res = await prisma.authenticator.deleteMany({ where: { id, userId: user.id } });
  if (res.count > 0) {
    await audit("passkey.remove", {
      actor: { id: user.id, email: user.email, role: user.role },
      tenantId: user.tenantId,
      targetType: "User",
      targetId: user.id,
    });
  }
  revalidatePath("/account/beveiliging");
}

/** Hernoem een eigen passkey. */
export async function renamePasskey(id: string, name: string): Promise<void> {
  const user = await requireAccount();
  await prisma.authenticator.updateMany({
    where: { id, userId: user.id },
    data: { name: name.trim().slice(0, 60) || null },
  });
  revalidatePath("/account/beveiliging");
}
