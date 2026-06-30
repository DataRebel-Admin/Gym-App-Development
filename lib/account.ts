import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Vereist een ingelogde gebruiker (elke rol). Retourneert de session-user. */
export async function requireAccount() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  pendingEmail: true,
  emailVerified: true,
  name: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  phone: true,
  timezone: true,
  locale: true,
  image: true,
  role: true,
  preferences: true,
  notificationPrefs: true,
  consents: true,
  deletionRequestedAt: true,
  createdAt: true,
} as const;

/** Volledig account-record van de huidige gebruiker. */
export async function getAccountUser() {
  const me = await requireAccount();
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: ACCOUNT_SELECT,
  });
  if (!user) redirect("/login");
  return user;
}
