import { prisma } from "@/lib/db";
import { getAccountUser } from "@/lib/account";
import { buttonClasses } from "@/components/ui/button-classes";
import { PasswordForm } from "./password-form";
import { TwoFactor } from "./two-factor";
import { logoutAllDevices } from "../security-actions";

const DT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

const SEC_LABEL: Record<string, string> = {
  "auth.login": "Ingelogd",
  "auth.logout": "Uitgelogd",
  "auth.login.failed": "Mislukte login",
  "password.change": "Wachtwoord gewijzigd",
  "2fa.enabled": "2FA ingeschakeld",
  "2fa.disabled": "2FA uitgeschakeld",
  "sessions.revoke_all": "Overal uitgelogd",
  "email.change.confirmed": "E-mail gewijzigd",
};

export const metadata = { title: "Beveiliging" };

export default async function SecurityPage() {
  const user = await getAccountUser();
  const hasPassword = Boolean((await prisma.user.findUnique({
    where: { id: user.id }, select: { passwordHash: true },
  }))?.passwordHash);
  const twoFactorEnabled = Boolean((await prisma.user.findUnique({
    where: { id: user.id }, select: { twoFactorEnabled: true },
  }))?.twoFactorEnabled);

  const [sessions, lastLogin, activity] = await Promise.all([
    prisma.userSession.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.findFirst({
      where: { actorId: user.id, action: "auth.login" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, ipAddress: true },
    }),
    prisma.auditLog.findMany({
      where: { actorId: user.id, action: { startsWith: "auth." } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, action: true, createdAt: true, ipAddress: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Beveiliging</h1>
        <p className="mt-1 text-sm text-neutral-500">Wachtwoord, twee-factor en je sessies.</p>
      </header>

      {lastLogin ? (
        <p className="text-sm text-neutral-500">
          Laatste login: <span className="font-medium text-neutral-900">{DT.format(lastLogin.createdAt)}</span>
          {lastLogin.ipAddress ? <> · IP {lastLogin.ipAddress}</> : null}
        </p>
      ) : null}

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Wachtwoord</h2>
        <PasswordForm hasPassword={hasPassword} />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Twee-factor-authenticatie</h2>
          <p className="mt-1 text-sm text-neutral-500">Extra beveiliging via een authenticator-app (TOTP).</p>
        </div>
        <TwoFactor enabled={twoFactorEnabled} />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Actieve sessies</h2>
          <form action={logoutAllDevices}>
            <button type="submit" className={buttonClasses({ variant: "outline", size: "sm" })}>
              Overal uitloggen
            </button>
          </form>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">Geen geregistreerde sessies.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-neutral-700">{s.userAgent ?? "Onbekend apparaat"}</span>
                <span className="shrink-0 text-xs text-neutral-400">
                  {s.ip ? `${s.ip} · ` : ""}{DT.format(s.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-neutral-400">
          &ldquo;Overal uitloggen&rdquo; verloopt alle bestaande sessies; je logt nu opnieuw in.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Recente beveiligingsactiviteit</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-neutral-500">Nog geen activiteit.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-neutral-700">{SEC_LABEL[a.action] ?? a.action}</span>
                <span className="shrink-0 text-xs text-neutral-400">
                  {a.ipAddress ? `${a.ipAddress} · ` : ""}{DT.format(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
