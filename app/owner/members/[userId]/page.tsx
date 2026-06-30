import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requireOwner } from "@/lib/owner";
import { deriveInviteStatus, INVITE_STATUS_LABEL, type InviteStatus } from "@/lib/members";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { MemberEditForm } from "./member-edit-form";

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
  const owner = await requireOwner();
  const { userId } = await params;

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId },
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
  });
  if (!member) notFound();

  const invitation = await prisma.invitation.findUnique({
    where: { tenantId_email: { tenantId: owner.tenantId, email: member.email } },
    select: { acceptedAt: true, expiresAt: true },
  });
  const status = deriveInviteStatus(member, invitation ?? undefined);

  const assignment = await prisma.assignedWorkout.findFirst({
    where: { tenantId: owner.tenantId, userId: member.id },
    include: { template: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
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

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Gegevens</h2>
        <MemberEditForm member={{ id: member.id, name: member.name, role: member.role }} />
      </section>

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

      <Link
        href={`/owner/schemas/members/${member.id}`}
        className="text-sm font-medium text-accent hover:underline"
      >
        Schema beheren →
      </Link>
    </div>
  );
}
