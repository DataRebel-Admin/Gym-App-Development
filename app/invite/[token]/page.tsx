import { prisma } from "@/lib/db";
import { acceptInvitation } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  TENANT_ADMIN: "beheerder",
  TENANT_MEMBER: "lid",
};

export const metadata = { title: "Uitnodiging" };

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { tenant: { select: { name: true, status: true, deletedAt: true } } },
  });

  const invalid =
    !invite ||
    invite.acceptedAt ||
    invite.expiresAt < new Date() ||
    !invite.tenant ||
    invite.tenant.deletedAt ||
    invite.tenant.status !== "ACTIVE";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-neutral-200 p-8">
        {invalid ? (
          <>
            <h1 className="text-xl font-semibold text-neutral-900">
              Uitnodiging ongeldig
            </h1>
            <p className="text-sm text-neutral-500">
              Deze uitnodiging bestaat niet, is verlopen of al gebruikt. Vraag de
              beheerder om een nieuwe.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-neutral-900">
              Welkom bij {invite!.tenant!.name}
            </h1>
            <p className="text-sm text-neutral-500">
              Je bent uitgenodigd als {ROLE_LABEL[invite!.role]} voor{" "}
              <span className="font-medium text-neutral-900">{invite!.email}</span>.
              Accepteer om je account te activeren.
            </p>
            <form action={acceptInvitation}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground hover:opacity-90"
              >
                Uitnodiging accepteren
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
