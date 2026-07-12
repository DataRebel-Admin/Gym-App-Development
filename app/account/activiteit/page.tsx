import { prisma } from "@/lib/db";
import { getAccountUser } from "@/lib/account";
import { AccountPageHeader } from "@/components/account/account-page-header";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Ingelogd",
  "auth.logout": "Uitgelogd",
  "auth.login.failed": "Mislukte login",
  "profile.update": "Profiel bijgewerkt",
  "profile.avatar": "Profielfoto gewijzigd",
  "email.change.requested": "E-mailwijziging aangevraagd",
  "email.change.confirmed": "E-mailadres gewijzigd",
  "privacy.consent.update": "Toestemmingen bijgewerkt",
  "privacy.export": "Gegevens geëxporteerd",
  "account.deletion.request": "Verwijdering aangevraagd",
  "account.deletion.cancel": "Verwijderverzoek geannuleerd",
};

function label(action: string) {
  return ACTION_LABEL[action] ?? action;
}

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
              <span className="font-medium text-neutral-900">{label(l.action)}</span>
              <span className="shrink-0 text-neutral-500">{DATE_FMT.format(l.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
