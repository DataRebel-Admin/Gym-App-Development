import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/staff";
import { deriveInviteStatus, INVITE_STATUS_LABEL, type InviteStatus } from "@/lib/members";
import { listMemberCoaches, listAvailableCoaches } from "@/lib/coach-assignments";
import { getMemberMoodInsight, getMemberFavorites } from "@/lib/member-insights";
import { getAchievementsView } from "@/lib/achievements/evaluate";
import { MoodInsightCard } from "@/components/members/mood-insight-card";
import { MemberProfileAchievements } from "@/components/achievements/member-profile-panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button-classes";
import { MemberProfileTabs } from "@/components/members/profile-tabs";
import { MemberProfileAssistant } from "@/components/ai/member-profile-assistant";
import { isAiEnabled } from "@/lib/ai/enabled";
import { surfaceSuggestions } from "@/lib/ai";
import { MemberEditForm } from "./member-edit-form";
import { assignCoach, unassignCoach, selfAssignCoach, selfUnassignCoach } from "../actions";
import { askMemberProfileAssistant, applyMemberProfileProposal } from "./ai-actions";

const COACH_ROLE_LABEL: Record<string, string> = {
  TENANT_ADMIN: "Eigenaar",
  TENANT_STAFF: "Medewerker",
};

const STATUS_TONE: Record<InviteStatus, BadgeTone> = {
  GEACTIVEERD: "success",
  VERZONDEN: "accent",
  VERLOPEN: "danger",
  NIET_UITGENODIGD: "neutral",
};

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const tenant = await getCurrentTenant();
  const member = tenant
    ? await prisma.user.findFirst({
        where: { id: userId, tenantId: tenant.id },
        select: { name: true, email: true },
      })
    : null;
  const label = member?.name ?? member?.email ?? "Lid";
  return { title: `${label} | Lid` };
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const me = await requirePermission("members:view");
  const isAdmin = me.role === "TENANT_ADMIN";
  const canSchema = me.permissions.has("schemas:manage");
  const { userId } = await params;

  const [member, tenantFlags] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenantId: me.tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        archivedAt: true,
        createdAt: true,
        emailVerified: true,
      },
    }),
    prisma.tenant.findUnique({
      where: { id: me.tenantId },
      select: { achievementsEnabled: true, aiEnabled: true },
    }),
  ]);
  if (!member) notFound();

  // AI-coachkaart: alleen als de AI-module beschikbaar is (Superadmin-flag + owner-toggle).
  const aiEnabled = await isAiEnabled(me.tenantId);

  const invitation = await prisma.invitation.findUnique({
    where: { tenantId_email: { tenantId: me.tenantId, email: member.email } },
    select: { acceptedAt: true, expiresAt: true },
  });
  const status = deriveInviteStatus(member, invitation ?? undefined);

  const assignment = await prisma.assignedWorkout.findFirst({
    where: { tenantId: me.tenantId, userId: member.id, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    include: { template: { select: { name: true } } },
  });

  // Coach-koppelingen (alleen zinvol voor een sporter).
  const isMember = member.role === "TENANT_MEMBER";
  const [coaches, availableCoaches] = isMember
    ? await Promise.all([
        listMemberCoaches(me.tenantId, member.id),
        isAdmin ? listAvailableCoaches(me.tenantId) : Promise.resolve([]),
      ])
    : [[], []];
  const assignedCoachIds = new Set(coaches.map((c) => c.coachId));
  const assignable = availableCoaches.filter((c) => !assignedCoachIds.has(c.id));

  // Coach-inzichten (alleen voor sporters): trainingsbeleving + favorieten.
  const [moodInsight, favorites] = isMember
    ? await Promise.all([
        getMemberMoodInsight(me.tenantId, member.id),
        getMemberFavorites(me.tenantId, member.id),
      ])
    : [null, []];

  // Achievements-samenvatting (alleen voor sporters bij een gym met trofeeën aan).
  const achievementsView =
    isMember && tenantFlags?.achievementsEnabled
      ? await getAchievementsView(member.id, me.tenantId)
      : null;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link href="/owner/members" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Leden
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-neutral-900">
          {member.name ?? member.email}
          <Badge tone={STATUS_TONE[status]}>{INVITE_STATUS_LABEL[status]}</Badge>
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{member.email}</p>
      </div>

      <MemberProfileTabs
        userId={member.id}
        active="profiel"
        canMeasure={me.permissions.has("measurements:manage")}
        canNotes={me.permissions.has("coachnotes:manage")}
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Gegevens</h2>
        {isAdmin ? (
          <MemberEditForm member={{ id: member.id, name: member.name, role: member.role }} />
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-neutral-500">Naam</dt>
              <dd className="font-medium text-neutral-900">{member.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">E-mail</dt>
              <dd className="font-medium text-neutral-900">{member.email}</dd>
            </div>
          </dl>
        )}
      </section>

      {isMember && aiEnabled ? (
        <MemberProfileAssistant
          ask={askMemberProfileAssistant.bind(null, member.id)}
          onApply={
            me.permissions.has("coachnotes:manage")
              ? applyMemberProfileProposal.bind(null, member.id)
              : undefined
          }
          suggestions={surfaceSuggestions("member-profile")}
        />
      ) : null}

      {isMember ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Coaches</h2>
          {coaches.length === 0 ? (
            <p className="text-sm text-neutral-500">Nog geen coach gekoppeld.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {coaches.map((c) => (
                <li
                  key={c.assignmentId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-900">
                      {c.name ?? c.email}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {COACH_ROLE_LABEL[c.role] ?? c.role}
                    </span>
                  </span>
                  {isAdmin ? (
                    <form action={unassignCoach}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <input type="hidden" name="coachId" value={c.coachId} />
                      <button
                        type="submit"
                        className="rounded-lg border border-border-strong px-2 py-1 text-xs hover:bg-neutral-50"
                      >
                        Loskoppelen
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {isAdmin && assignable.length > 0 ? (
            <form action={assignCoach} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="memberId" value={member.id} />
              <Select name="coachId" defaultValue="" className="h-9 w-full py-1 text-sm sm:w-64" required>
                <option value="" disabled>
                  Kies een coach…
                </option>
                {assignable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.name ?? c.email) + ` (${COACH_ROLE_LABEL[c.role] ?? c.role})`}
                  </option>
                ))}
              </Select>
              <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Coach koppelen
              </button>
            </form>
          ) : null}

          {/* Medewerker mag (indien toegestaan) zichzelf koppelen/loskoppelen. */}
          {!isAdmin && me.permissions.has("members:assign-self") ? (
            assignedCoachIds.has(me.id) ? (
              <form action={selfUnassignCoach}>
                <input type="hidden" name="memberId" value={member.id} />
                <button type="submit" className={buttonClasses({ variant: "outline", size: "sm" })}>
                  Mij loskoppelen als coach
                </button>
              </form>
            ) : (
              <form action={selfAssignCoach}>
                <input type="hidden" name="memberId" value={member.id} />
                <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  Mij koppelen als coach
                </button>
              </form>
            )
          ) : null}
        </section>
      ) : null}

      {achievementsView ? <MemberProfileAchievements view={achievementsView} /> : null}

      {isMember && moodInsight ? <MoodInsightCard insight={moodInsight} /> : null}

      {isMember ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Favoriete oefeningen</h2>
          {favorites.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Dit lid heeft nog geen oefeningen als favoriet gemarkeerd.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {favorites.map((f) => (
                <li
                  key={f.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm capitalize text-neutral-800"
                >
                  <span className="text-accent">★</span>
                  {f.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-4 rounded-2xl border border-border p-5 text-sm sm:grid-cols-3">
        <div>
          <p className="text-neutral-500">Lid sinds</p>
          <p className="font-medium text-neutral-900">{DATE_FMT.format(member.createdAt)}</p>
        </div>
        <div>
          <p className="text-neutral-500">Account</p>
          <p className="font-medium text-neutral-900">{member.active ? "Actief" : "Gedeactiveerd"}</p>
        </div>
        <div>
          <p className="text-neutral-500">Schema</p>
          <p className="font-medium text-neutral-900">
            {assignment?.template?.name ?? assignment?.customName ?? "Geen"}
          </p>
        </div>
      </section>

      {canSchema ? (
        <Link
          href={`/owner/schemas/members/${member.id}`}
          className="text-sm font-medium text-accent hover:underline"
        >
          Schema beheren →
        </Link>
      ) : null}
    </div>
  );
}
