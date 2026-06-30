"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { audit } from "@/lib/audit";
import { notifyRequestSubmitted } from "@/lib/schema-requests-notify";

export type RequestFormState = { error?: string; ok?: boolean };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const submitSchema = z.object({
  goal: z.enum(["MUSCLE", "WEIGHT_LOSS", "CONDITION", "REHAB", "STRENGTH", "OTHER"]),
  description: z.string().trim().max(2000).optional(),
  preferredStart: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dien een nieuwe schema-aanvraag in (sporter). */
export async function submitRequest(
  _prev: RequestFormState,
  formData: FormData
): Promise<RequestFormState> {
  const member = await requireMember();

  const parsed = submitSchema.safeParse({
    goal: formData.get("goal"),
    description: formData.get("description") ?? undefined,
    preferredStart: formData.get("preferredStart") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { error: "Kies een doel en controleer de velden." };
  const { goal, description, preferredStart, notes } = parsed.data;

  // Voorkom een wildgroei aan open aanvragen: maximaal 1 openstaande per lid.
  const open = await prisma.schemaRequest.count({
    where: {
      tenantId: member.tenantId,
      userId: member.id,
      status: { in: ["NEW", "IN_PROGRESS", "SCHEMA_CREATED"] },
    },
  });
  if (open > 0) {
    return { error: "Je hebt al een lopende aanvraag. Wacht tot je trainer die heeft afgerond." };
  }

  const request = await prisma.schemaRequest.create({
    data: {
      tenantId: member.tenantId,
      userId: member.id,
      goal,
      description: description || null,
      preferredStart: parseDate(preferredStart),
      notes: notes || null,
    },
    select: { id: true },
  });

  await audit("request.submit", {
    actor: member,
    tenantId: member.tenantId,
    targetType: "SchemaRequest",
    targetId: request.id,
    metadata: { member: member.name ?? member.email, goal },
  });

  await notifyRequestSubmitted({
    tenantId: member.tenantId,
    requestId: request.id,
    origin: await origin(),
  });

  revalidatePath("/member/requests");
  return { ok: true };
}

/** Annuleer een eigen, nog openstaande aanvraag. */
export async function cancelRequest(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = String(formData.get("id") ?? "");

  const { count } = await prisma.schemaRequest.updateMany({
    where: {
      id,
      tenantId: member.tenantId,
      userId: member.id,
      status: { in: ["NEW", "IN_PROGRESS"] },
    },
    data: { status: "CANCELLED" },
  });

  if (count > 0) {
    await audit("request.cancel", {
      actor: member,
      tenantId: member.tenantId,
      targetType: "SchemaRequest",
      targetId: id,
    });
  }
  revalidatePath("/member/requests");
}
