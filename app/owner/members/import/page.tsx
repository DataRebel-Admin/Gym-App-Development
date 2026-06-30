import { requireOwner } from "@/lib/owner";
import { prisma } from "@/lib/db";
import { ImportWizard } from "@/components/member/import/import-wizard";

export const metadata = { title: "Leden importeren" };

export default async function ImportMembersPage() {
  const owner = await requireOwner();

  // Bestaande lid-e-mails voor client-side dubbeldetectie tijdens validatie.
  const users = await prisma.user.findMany({
    where: { tenantId: owner.tenantId, role: { in: ["TENANT_ADMIN", "TENANT_MEMBER"] } },
    select: { email: true },
  });

  return <ImportWizard existingEmails={users.map((u) => u.email)} />;
}
