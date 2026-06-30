"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { audit } from "@/lib/audit";
import { notifyRequestStatusChanged } from "@/lib/schema-requests-notify";
import { REQUEST_STATUS_META } from "@/lib/schema-requests";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "IN_PROGRESS", "SCHEMA_CREATED", "COMPLETED", "REJECTED", "CANCELLED"]),
});

/** Zet de status van een aanvraag (coach) en informeer het lid. */
export async function setRequestStatus(formData: FormData): Promise<void> {
  const owner = await requirePermission("schemas:manage");
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;
  const { id, status } = parsed.data;

  const { count } = await prisma.schemaRequest.updateMany({
    where: { id, tenantId: owner.tenantId },
    data: { status, handledById: owner.id },
  });
  if (count === 0) return;

  await audit("request.status.change", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "SchemaRequest",
    targetId: id,
    metadata: { status: REQUEST_STATUS_META[status].label },
  });

  await notifyRequestStatusChanged({
    tenantId: owner.tenantId,
    requestId: id,
    origin: await origin(),
  });

  revalidatePath("/owner/requests");
}
