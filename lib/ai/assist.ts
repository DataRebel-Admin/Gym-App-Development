import "server-only";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { applySafetyGuardrail, SAFETY_FALLBACK } from "@/lib/ai-guardrail";
import { aiConfigured, callModel } from "./provider";
import { getSurface } from "./surfaces/registry";
import type { AiRole } from "./surfaces/base";
import type { AssistantAnswer, AssistantProposal, AssistantResult } from "./types";

/**
 * Orchestrator van de AI Coach & Assistant. Eén ingang voor álle oppervlakken:
 * gate (aiEnabled) → rate-limit → context (surface.build) → model → defensieve parse
 * + safety-guardrail → gebruik loggen. Faalt nooit hard: elk pad geeft een
 * `AssistantResult` terug (antwoord óf nette foutmelding).
 *
 * De aanroepende server-action dwingt zélf de rol/permissie af (requireMember /
 * requirePermission) en geeft de reeds-geauthenticeerde gebruiker hierin door.
 */

const DAILY_LIMIT = 20;
const questionSchema = z.string().trim().min(1).max(500);

export type RunSurfaceInput = {
  surfaceId: string;
  question: string;
  /** Surface-specifiek referentie-id (bv. exerciseId of memberId). */
  ref?: string | null;
  user: { id: string; tenantId: string; role: AiRole };
};

/** App-rol → assistent-rol. `null` = geen assistent-toegang (bv. superadmin/onbekend). */
export function aiRoleFor(role: Role): AiRole | null {
  if (role === "TENANT_MEMBER") return "member";
  if (role === "TENANT_ADMIN" || role === "TENANT_STAFF") return "coach";
  return null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Haal het JSON-object uit de modeltekst (strip eventuele codeblokken). */
function extractJson(text: string): string | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return t.slice(start, end + 1);
}

function normalizeProposals(raw: unknown): AssistantProposal[] {
  if (!Array.isArray(raw)) return [];
  const out: AssistantProposal[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    if (typeof o.kind !== "string" || typeof o.title !== "string") continue;
    out.push({
      id: crypto.randomUUID(),
      kind: o.kind,
      title: o.title,
      summary: typeof o.summary === "string" ? o.summary : "",
      applyLabel: null,
      payload: o.payload ?? {},
    });
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Parse het model-antwoord defensief naar `{ text, proposals }`. Geen/ongeldige JSON →
 * de volledige tekst is het antwoord met 0 proposals. De safety-guardrail draait altijd
 * op de antwoord-tekst; slaat die aan, dan vervallen ook alle proposals.
 */
function parseAnswer(raw: string): AssistantAnswer {
  const text = raw.trim();
  const json = extractJson(text);
  if (json) {
    try {
      const obj = JSON.parse(json) as Record<string, unknown>;
      const answerText =
        typeof obj.answer === "string" && obj.answer.trim() ? obj.answer : text;
      const safe = applySafetyGuardrail(answerText);
      const proposals = safe === SAFETY_FALLBACK ? [] : normalizeProposals(obj.proposals);
      return { text: safe, proposals };
    } catch {
      // Val door naar plain-tekst.
    }
  }
  return { text: applySafetyGuardrail(text), proposals: [] };
}

export async function runSurfaceAssistant(
  input: RunSurfaceInput
): Promise<AssistantResult> {
  const surface = getSurface(input.surfaceId);
  if (!surface) return { error: "Onbekend AI-oppervlak." };
  if (!surface.roles.includes(input.user.role)) {
    return { error: "Je hebt geen toegang tot deze assistent." };
  }

  const parsed = questionSchema.safeParse(input.question);
  if (!parsed.success) return { error: "Stel een vraag van 1–500 tekens." };

  if (!aiConfigured()) {
    return {
      error:
        "De AI-assistent is nog niet geconfigureerd. Vraag de eigenaar om een API-sleutel in te stellen.",
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.user.tenantId },
    select: { name: true, locale: true, aiEnabled: true },
  });
  if (!tenant?.aiEnabled) {
    return { error: "De AI-assistent staat uit voor deze sportschool." };
  }

  // Rate-limit: max 20 vragen per dag per gebruiker (over álle oppervlakken samen).
  const usedToday = await prisma.aiUsage.count({
    where: { userId: input.user.id, createdAt: { gte: startOfToday() } },
  });
  if (usedToday >= DAILY_LIMIT) {
    return {
      error: `Daglimiet bereikt (${DAILY_LIMIT} vragen). Probeer het morgen weer.`,
    };
  }

  const built = await surface.build({
    user: { ...input.user, locale: tenant.locale },
    tenantName: tenant.name,
    ref: input.ref ?? null,
  });
  if (!built) return { error: "Geen context beschikbaar voor deze assistent." };

  let raw: string | null;
  try {
    raw = await callModel({
      system: built.system,
      messages: [{ role: "user", content: parsed.data }],
    });
  } catch {
    return { error: "Er ging iets mis met de assistent. Probeer het later opnieuw." };
  }

  // Claude safety-refusal → verplichte doorverwijzing.
  if (raw === null) return { text: SAFETY_FALLBACK, proposals: [] };

  const answer = parseAnswer(raw);

  // Registreer het gebruik (na een succesvol antwoord) voor rate-limit + kostenmonitoring.
  await prisma.aiUsage.create({
    data: { tenantId: input.user.tenantId, userId: input.user.id },
  });

  return answer;
}
