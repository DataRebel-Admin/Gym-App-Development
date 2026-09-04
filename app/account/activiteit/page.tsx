import { prisma } from "@/lib/db";
import { getAccountUser } from "@/lib/account";
import { getActionDef } from "@/lib/audit-actions";
import { AccountPageHeader } from "@/components/account/account-page-header";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Labels komen uit de centrale audit-registry (lib/audit-actions.ts): onbekende
// acties degraderen daar netjes en nieuwe events hoeven maar op één plek een naam.

export const metadata = { title: "Activiteit" };

export default async function ActivityPage() {
  const me = await getAccountUser();

  const logs = await prisma.auditLog.findMany({
    where: { actorId: me.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, action: true, createdAt: true, targetType: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <AccountPageHeader
        title="Activiteit"
        description="Je recente account- en beveiligingsactiviteit (laatste 50)."
      />

      {logs.length === 0 ? (
        <p className="text-sm text-neutral-500">Nog geen activiteit.</p>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-border bg-surface-1">
          {logs.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-3 text-sm last:border-0"
            >
              <span className="min-w-0 truncate font-medium text-neutral-900">{getActionDef(l.action).label}</span>
              <span className="shrink-0 text-neutral-500">{DATE_FMT.format(l.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
