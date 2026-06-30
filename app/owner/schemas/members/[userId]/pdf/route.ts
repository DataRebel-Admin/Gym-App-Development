import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { getAssignedSchema } from "@/lib/member";
import { buildSchemaPdf, type SchemaPdfDay } from "@/lib/schema-pdf";
import { targetSummaryFromItem } from "@/lib/exercise-params";

const VERSION_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const owner = await requirePermission("schemas:manage");
  const { userId } = await params;

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
    select: { name: true, email: true },
  });
  if (!member) return new NextResponse("Lid niet gevonden", { status: 404 });

  const assignment = await getAssignedSchema(userId, owner.tenantId);
  if (!assignment?.template) {
    return new NextResponse("Geen schema toegewezen", { status: 404 });
  }
  const tpl = assignment.template;

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: {
      name: true,
      accentColor: true,
      secondaryColor: true,
      logoUrl: true,
      website: true,
      contactEmail: true,
      contactPhone: true,
    },
  });

  const days: SchemaPdfDay[] = tpl.days.map((d) => ({
    name: d.name,
    items: d.items.map((it) => ({
      exercise: it.exercise.name,
      machine: it.exercise.machine?.name ?? null,
      sets: it.sets,
      reps: it.reps,
      weightKg: it.weightKg,
      restSeconds: it.restSeconds,
      tempo: it.tempo,
      exerciseType: it.exercise.exerciseType,
      summary: targetSummaryFromItem(it, it.exercise.exerciseType),
      notes: it.notes,
    })),
  }));

  const pdf = await buildSchemaPdf({
    tenantName: tenant?.name ?? "GymRebel",
    accentColor: tenant?.accentColor ?? null,
    secondaryColor: tenant?.secondaryColor ?? null,
    logoUrl: tenant?.logoUrl ?? null,
    memberName: member.name ?? member.email ?? "Lid",
    trainerName: owner.name ?? null,
    schemaName: tpl.name,
    intro: tpl.description,
    version: VERSION_FMT.format(tpl.updatedAt),
    createdAt: tpl.createdAt,
    website: tenant?.website ?? null,
    contactEmail: tenant?.contactEmail ?? null,
    contactPhone: tenant?.contactPhone ?? null,
    days,
  });

  const slug = (member.name ?? member.email ?? "lid")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="schema-${slug || "lid"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
