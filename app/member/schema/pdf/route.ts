import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { getCurrentTenant } from "@/lib/tenant";
import { buildSchemaPdf, type SchemaPdfDay } from "@/lib/schema-pdf";
import { audit } from "@/lib/audit";

const VERSION_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export async function GET() {
  const member = await requireMember();

  const assignment = await getAssignedSchema(member.id, member.tenantId);
  if (!assignment?.template) {
    return new NextResponse("Geen schema toegewezen", { status: 404 });
  }
  const tpl = assignment.template;
  const tenant = await getCurrentTenant();

  const days: SchemaPdfDay[] = tpl.days.map((d) => ({
    name: d.name,
    items: d.items.map((it) => ({
      exercise: it.exercise.name,
      machine: it.exercise.machine?.name ?? null,
      sets: it.sets,
      reps: it.reps,
      weightKg: it.weightKg,
      restSeconds: it.restSeconds,
      notes: it.notes,
    })),
  }));

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const onlineUrl = host ? `${proto}://${host}/member/schema` : null;

  const pdf = await buildSchemaPdf({
    tenantName: tenant?.name ?? "GymRebel",
    accentColor: tenant?.accentColor ?? null,
    secondaryColor: tenant?.secondaryColor ?? null,
    logoUrl: tenant?.logoUrl ?? null,
    memberName: member.name ?? member.email ?? "Lid",
    schemaName: tpl.name,
    intro: tpl.description,
    version: VERSION_FMT.format(tpl.updatedAt),
    createdAt: tpl.createdAt,
    onlineUrl,
    website: tenant?.website ?? null,
    contactEmail: tenant?.contactEmail ?? null,
    contactPhone: tenant?.contactPhone ?? null,
    days,
  });

  const slug = tpl.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  await audit("schema.pdf.export", {
    actor: { id: member.id, email: member.email, role: member.role },
    tenantId: member.tenantId,
    targetType: "WorkoutTemplate",
    targetId: tpl.id,
    metadata: { name: tpl.name },
  });

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="schema-${slug || "training"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
