import { NextResponse } from "next/server";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { getCurrentTenant } from "@/lib/tenant";
import { buildSchemaPdf } from "@/lib/schema-pdf";

export async function GET() {
  const member = await requireMember();

  const assignment = await getAssignedSchema(member.id, member.tenantId);
  if (!assignment?.template) {
    return new NextResponse("Geen schema toegewezen", { status: 404 });
  }

  const tenant = await getCurrentTenant();

  const pdf = await buildSchemaPdf({
    tenantName: tenant?.name ?? "GymRebel",
    logoUrl: tenant?.logoUrl ?? null,
    memberName: member.name ?? member.email ?? "Lid",
    schemaName: assignment.template.name,
    items: assignment.template.items.map((it) => ({
      exercise: it.exercise.name,
      machine: it.exercise.machine?.name ?? null,
      sets: it.sets,
      reps: it.reps,
    })),
  });

  const slug = assignment.template.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="schema-${slug || "training"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
