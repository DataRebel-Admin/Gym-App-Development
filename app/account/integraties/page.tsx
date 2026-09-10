import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAccountUser } from "@/lib/account";
import { getCurrentTenant } from "@/lib/tenant";
import { oauthEnabled } from "@/lib/oauth";
import { graphConfigured } from "@/lib/email/graph";
import { isFeatureEnabled } from "@/lib/features/service";
import { Badge } from "@/components/ui/badge";
import { AccountPageHeader } from "@/components/account/account-page-header";
import { oauthSignIn } from "@/app/login/actions";
import { getMemberMode } from "@/lib/member-mode-server";

const ACTION_BUTTON =
  "inline-flex h-10 items-center rounded-xl border border-border-strong px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50";

function StatusBadge({ ok, offLabel = "Niet verbonden" }: { ok: boolean; offLabel?: string }) {
  return ok ? <Badge tone="success">Verbonden</Badge> : <Badge tone="neutral">{offLabel}</Badge>;
}

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 py-4 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ConnectButton({
  provider,
  enabled,
  connected,
  tenantSlug,
}: {
  provider: string;
  enabled: boolean;
  connected: Set<string>;
  tenantSlug: string;
}) {
  if (connected.has(provider)) return <StatusBadge ok />;
  if (!enabled) return <Badge tone="neutral">Binnenkort</Badge>;
  return (
    <form action={oauthSignIn}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="tenant" value={tenantSlug} />
      <button type="submit" className={ACTION_BUTTON}>
        Verbinden
      </button>
    </form>
  );
}

export const metadata = { title: "Integraties" };

export default async function IntegrationsPage() {
  const user = await getAccountUser();
  const tenant = await getCurrentTenant();
  const oauth = oauthEnabled();

  const [accounts, feedUser] = await Promise.all([
    prisma.account.findMany({
      where: { userId: user.id },
      select: { provider: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { tenantId: true, calendarFeedToken: true },
    }),
  ]);
  const connected = new Set(accounts.map((a) => a.provider));
  const tenantSlug = tenant?.slug ?? "";

  const isAdmin = user.role === "TENANT_ADMIN";
  // Ook een eigenaar/medewerker met de lid-modus sport hier en heeft dus een
  // eigen agenda om te koppelen (lib/member-mode.ts).
  const { canTrain: isMember } = await getMemberMode();
  const agendaAvailable =
    isMember && feedUser?.tenantId
      ? await isFeatureEnabled(feedUser.tenantId, "calendar")
      : false;
  const feedConnected = Boolean(feedUser?.calendarFeedToken);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <AccountPageHeader title="Integraties" description="Verbonden accounts en koppelingen." />

      <section className="rounded-2xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Verbonden accounts</h2>
        <Row title="Microsoft" desc="Inloggen met je Microsoft Entra-account.">
          <ConnectButton provider="microsoft-entra-id" enabled={oauth.microsoft} connected={connected} tenantSlug={tenantSlug} />
        </Row>
        <Row title="Google" desc="Inloggen met je Google-account.">
          <ConnectButton provider="google" enabled={oauth.google} connected={connected} tenantSlug={tenantSlug} />
        </Row>
      </section>

      {agendaAvailable ? (
        <section className="rounded-2xl border border-border bg-surface-1 p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Agenda</h2>
          <Row
            title="Agendakoppeling"
            desc="Je trainingen en lessen in Google, Outlook of Apple Agenda."
          >
            <div className="flex items-center gap-3">
              <StatusBadge ok={feedConnected} />
              <Link href="/member/agenda/koppelen" className={ACTION_BUTTON}>
                {feedConnected ? "Beheren" : "Koppelen"}
              </Link>
            </div>
          </Row>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="rounded-2xl border border-border bg-surface-1 p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Koppelingen (sportschool)</h2>
          <Row title="Microsoft 365 / Azure Mail" desc="Uitnodigingsmails via Microsoft Graph.">
            <StatusBadge ok={graphConfigured()} offLabel="Binnenkort" />
          </Row>
          <Row title="AI-assistent" desc={`Provider: ${process.env.AI_PROVIDER ?? "anthropic"}.`}>
            <StatusBadge
              ok={Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)}
              offLabel="Binnenkort"
            />
          </Row>
        </section>
      ) : null}
    </div>
  );
}
