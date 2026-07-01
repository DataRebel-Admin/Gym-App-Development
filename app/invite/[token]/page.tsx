import Link from "next/link";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { Reveal } from "@/components/motion/reveal";
import { ActivationForm, ResendForm } from "./activation-form";

export const metadata = { title: "Account activeren" };

const ROLE_LABEL: Record<string, string> = {
  TENANT_ADMIN: "beheerder",
  TENANT_STAFF: "medewerker",
  TENANT_MEMBER: "lid",
};

type Status = "ok" | "expired" | "accepted" | "invalid";

export default async function InviteActivationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ resent?: string }>;
}) {
  const { token } = await params;
  const { resent } = await searchParams;

  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { tenant: { select: { slug: true, name: true, logoUrl: true, accentColor: true, status: true, deletedAt: true } } },
  });

  let status: Status = "ok";
  if (!invite || !invite.tenant || invite.tenant.deletedAt || invite.tenant.status !== "ACTIVE") {
    status = "invalid";
  } else if (invite.acceptedAt) {
    status = "accepted";
  } else if (invite.expiresAt < new Date()) {
    status = "expired";
  }

  // Uitnodiger-naam (geen FK op het model → losse lookup) voor de welkomsttekst.
  let inviterName: string | null = null;
  if (invite?.invitedById) {
    const inviter = await prisma.user.findUnique({
      where: { id: invite.invitedById },
      select: { name: true, firstName: true },
    });
    inviterName = inviter?.name ?? inviter?.firstName ?? null;
  }

  // Audit-logging op openen (best-effort, faalt nooit hard via lib/audit).
  if (invite) {
    if (status === "ok") {
      await audit("user.activate.opened", {
        actor: { email: invite.email, role: invite.role },
        tenantId: invite.tenantId,
        targetType: "Invitation",
        metadata: { email: invite.email },
      });
    } else if (status === "expired") {
      await audit("user.activate.expired", {
        actor: { email: invite.email, role: invite.role },
        tenantId: invite.tenantId,
        targetType: "Invitation",
        metadata: { email: invite.email },
      });
    }
  }

  const tenant = invite?.tenant ?? null;
  const name = tenant?.name ?? "GymRebel";
  const initial = name.charAt(0).toUpperCase();
  const roleLabel = invite ? ROLE_LABEL[invite.role] ?? "lid" : "lid";
  const loginHref = tenant ? `/login?tenant=${tenant.slug}` : "/login";
  const accent = tenant?.accentColor ?? undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      {/* Accent per uitgenodigde tenant — onafhankelijk van de request-tenant. */}
      <div style={accent ? ({ ["--tenant-accent" as string]: accent } as React.CSSProperties) : undefined} className="w-full max-w-md">
        <Reveal className="overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-lg">
          {/* Gebrande header */}
          <header className="relative flex flex-col items-center gap-3 overflow-hidden bg-accent-gradient px-8 py-9 text-center text-accent-foreground">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "radial-gradient(60% 60% at 20% 0%, rgb(255 255 255 / 0.25) 0%, transparent 60%), radial-gradient(50% 60% at 100% 100%, rgb(0 0 0 / 0.18) 0%, transparent 55%)",
              }}
            />
            {tenant?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt=""
                className="relative h-16 w-16 rounded-2xl bg-white/15 object-contain p-2 ring-1 ring-white/25"
              />
            ) : (
              <span className="relative flex size-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold ring-1 ring-white/25">
                {initial}
              </span>
            )}
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent-foreground/70">
                {name}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
                {status === "ok" ? "Welkom! Activeer je account" : "Account activeren"}
              </h1>
            </div>
          </header>

          <div className="flex flex-col gap-5 px-8 py-8">
            {status === "ok" ? (
              <>
                {resent ? (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-xs font-medium text-emerald-700">
                    Er is een nieuwe activatielink naar je e-mail verstuurd.
                  </p>
                ) : null}
                <p className="text-center text-sm text-neutral-600">
                  Je bent uitgenodigd als {roleLabel} bij{" "}
                  <span className="font-semibold text-neutral-900">{name}</span>
                  {inviterName ? (
                    <>
                      {" "}
                      door <span className="font-medium text-neutral-800">{inviterName}</span>
                    </>
                  ) : null}
                  . Stel een wachtwoord in om te beginnen.
                </p>
                <ActivationForm token={token} />
              </>
            ) : status === "expired" ? (
              <StatePanel
                icon="⌛"
                title="Deze activatielink is verlopen"
                body="Uit veiligheidsoverwegingen is je uitnodiging verlopen. Vraag hieronder een nieuwe aan — die sturen we naar hetzelfde e-mailadres."
              >
                <ResendForm token={token} />
              </StatePanel>
            ) : status === "accepted" ? (
              <StatePanel
                icon="✅"
                title="Je account is al geactiveerd"
                body="Deze activatielink is al gebruikt en kan niet opnieuw worden geopend. Log direct in om verder te gaan."
              >
                <Link
                  href={loginHref}
                  className="flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-ring"
                >
                  Inloggen
                </Link>
              </StatePanel>
            ) : (
              <StatePanel
                icon="⚠️"
                title="Uitnodiging ongeldig"
                body="Deze uitnodiging bestaat niet of is niet langer geldig. Vraag de sportschool om een nieuwe uitnodiging."
              >
                <Link
                  href="/login"
                  className="flex w-full items-center justify-center rounded-xl border border-border-strong bg-surface-1 px-5 py-3 font-semibold text-neutral-900 transition-colors hover:bg-neutral-100 focus-ring"
                >
                  Naar inloggen
                </Link>
              </StatePanel>
            )}
          </div>
        </Reveal>
      </div>
    </main>
  );
}

function StatePanel({
  icon,
  title,
  body,
  children,
}: {
  icon: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">
        {icon}
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500">{body}</p>
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}
