"use server";

import { z } from "zod";
import type { SchemaRequestKind } from "@prisma/client";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { audit } from "@/lib/audit";
import { notifyRequestSubmitted } from "@/lib/schema-requests-notify";
import {
  canSubmitRequest,
  parseRequestKind,
  DELETABLE_REQUEST_STATUSES,
  OPEN_REQUEST_STATUSES,
} from "@/lib/schema-requests";

export type RequestFormState = { error?: string; ok?: boolean };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Twee aanvraagtypes, twee formulieren (zie lib/schema-requests.ts). Een
 * nieuw-schema-aanvraag draait om doel + gewenste start; een aanpassing draait om
 * één vraag: wat moet er anders? Daarom een discriminated union i.p.v. één schema
 * met overal optionele velden — de server valideert precies wat het type nodig heeft.
 */
const submitSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("NEW_SCHEMA"),
    goal: z.enum(["MUSCLE", "WEIGHT_LOSS", "CONDITION", "REHAB", "STRENGTH", "OTHER"]),
    description: z.string().trim().max(2000).optional(),
    preferredStart: z.string().trim().optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({
    kind: z.literal("CHANGE"),
    // Zonder toelichting weet de coach niet wát er anders moet → verplicht.
    description: z.string().trim().min(5).max(2000),
    notes: z.string().trim().max(2000).optional(),
  }),
]);

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dien een schema-aanvraag in (sporter): een nieuw schema óf een aanpassing. */
export async function submitRequest(
  _prev: RequestFormState,
  formData: FormData
): Promise<RequestFormState> {
  const member = await requireMember();

  const kind = parseRequestKind(String(formData.get("kind") ?? ""));
  const parsed = submitSchema.safeParse({
    kind,
    goal: formData.get("goal") ?? undefined,
    description: formData.get("description") ?? undefined,
    preferredStart: formData.get("preferredStart") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return {
      error:
        kind === "CHANGE"
          ? "Vertel kort wat je wilt aanpassen."
          : "Kies een doel en controleer de velden.",
    };
  }
  const data = parsed.data;

  // Eén openstaande aanvraag per type: een aanpassingsverzoek hoeft niet te
  // wachten op een lopende nieuw-schema-aanvraag (en omgekeerd).
  const openRows = await prisma.schemaRequest.findMany({
    where: {
      tenantId: member.tenantId,
      userId: member.id,
      status: { in: OPEN_REQUEST_STATUSES },
    },
    select: { kind: true },
  });
  if (!canSubmitRequest(kind, openRows.map((r) => r.kind))) {
    return {
      error:
        kind === "CHANGE"
          ? "Je hebt al een openstaand aanpassingsverzoek. Wacht tot je trainer dat heeft opgepakt."
          : "Je hebt al een lopende aanvraag. Wacht tot je trainer die heeft afgerond.",
    };
  }

  const request = await prisma.schemaRequest.create({
    data: {
      tenantId: member.tenantId,
      userId: member.id,
      kind,
      // Een aanpassing kiest geen doel en geen startdatum — die velden bestaan
      // niet in dat formulier en blijven dus leeg.
      goal: data.kind === "NEW_SCHEMA" ? data.goal : null,
      description: data.description || null,
      preferredStart:
        data.kind === "NEW_SCHEMA" ? parseDate(data.preferredStart) : null,
      notes: data.notes || null,
    },
    select: { id: true },
  });

  await audit(kind === "CHANGE" ? "request.change.submit" : "request.submit", {
    actor: member,
    tenantId: member.tenantId,
    targetType: "SchemaRequest",
    targetId: request.id,
    metadata: {
      member: member.name ?? member.email,
      ...(data.kind === "NEW_SCHEMA" ? { goal: data.goal } : {}),
    },
  });

  await notifyRequestSubmitted({
    tenantId: member.tenantId,
    requestId: request.id,
    origin: await origin(),
  });

  revalidatePath("/member/requests");
  return { ok: true };
}

/**
 * Het aanvraagtype ophalen voor de audit-zin ("aanpassingsverzoek" vs.
 * "schema-aanvraag"), meteen tenant- én eigenaar-gescoped. Levert `null` als de
 * aanvraag niet van dit lid is — dan doet de actie sowieso niets.
 */
async function ownRequestKind(
  member: { id: string; tenantId: string },
  id: string
): Promise<SchemaRequestKind | null> {
  const row = await prisma.schemaRequest.findFirst({
    where: { id, tenantId: member.tenantId, userId: member.id },
    select: { kind: true },
  });
  return row?.kind ?? null;
}

/**
 * Trek een eigen, nog openstaande aanvraag in — voor beide types. De aanvraag
 * blijft staan als `CANCELLED` zodat coach én lid zien dat er iets liep; alleen
 * `deleteRequest` haalt 'm daarna echt weg.
 *
 * De statusfilter in de `where` is de autoritatieve guard: een vreemde id, een
 * aanvraag van een ander lid of een al afgesloten aanvraag raakt simpelweg 0
 * rijen. Geen aparte read-check die kan verouderen.
 */
export async function cancelRequest(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const kind = await ownRequestKind(member, id);

  const { count } = await prisma.schemaRequest.updateMany({
    where: {
      id,
      tenantId: member.tenantId,
      userId: member.id,
      status: { in: OPEN_REQUEST_STATUSES },
    },
    data: { status: "CANCELLED" },
  });

  if (count > 0) {
    await audit("request.cancel", {
      actor: member,
      tenantId: member.tenantId,
      targetType: "SchemaRequest",
      targetId: id,
      metadata: { member: member.name ?? member.email, kind },
    });
  }
  revalidatePath("/member/requests");
}

/**
 * Verwijder een eigen, afgesloten aanvraag uit de lijst (opruimen). Alleen
 * `CANCELLED`/`REJECTED` — zie `DELETABLE_REQUEST_STATUSES` voor het waarom.
 * Harde delete kan veilig: er hangt geen downstream data aan een afgesloten
 * aanvraag, en het auditlog (zonder FK's) bewaart dat ze bestaan heeft.
 */
export async function deleteRequest(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const kind = await ownRequestKind(member, id);

  const { count } = await prisma.schemaRequest.deleteMany({
    where: {
      id,
      tenantId: member.tenantId,
      userId: member.id,
      status: { in: DELETABLE_REQUEST_STATUSES },
    },
  });

  if (count > 0) {
    await audit("request.delete", {
      actor: member,
      tenantId: member.tenantId,
      targetType: "SchemaRequest",
      targetId: id,
      metadata: { member: member.name ?? member.email, kind },
    });
  }
  revalidatePath("/member/requests");
}
