"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/staff";
import { memberBelongsToTenant } from "@/lib/coach-notes";
import {
  runSurfaceAssistant,
  type AssistantResult,
  type AssistantProposal,
} from "@/lib/ai";
import { SAVE_SUMMARY_NOTE } from "@/lib/ai/surfaces/member-profile";
import { addCoachNote } from "./notes/actions";

/**
 * AI Coach op het ledenprofiel (vlaggenschip). `askMemberProfileAssistant` vat de
 * voortgang samen en doet suggesties; `applyMemberProfileProposal` is het bevestig/
 * toepas-punt — de AI wijzigt nooit zélf data. Beide `requirePermission` + tenant-scope.
 */
export async function askMemberProfileAssistant(
  userId: string,
  question: string
): Promise<AssistantResult> {
  const me = await requirePermission("members:view");
  return runSurfaceAssistant({
    surfaceId: "member-profile",
    question,
    ref: userId,
    user: { id: me.id, tenantId: me.tenantId, role: "coach" },
  });
}

const notePayload = z.object({ body: z.string().trim().min(1).max(5000) });

export type ApplyProposalResult = { ok?: boolean; error?: string };

export async function applyMemberProfileProposal(
  userId: string,
  proposal: AssistantProposal
): Promise<ApplyProposalResult> {
  const me = await requirePermission("members:view");

  if (proposal.kind === SAVE_SUMMARY_NOTE) {
    // Coachnotitie schrijven vereist de expliciete permissie (defense-in-depth naast de UI).
    if (!me.permissions.has("coachnotes:manage")) {
      return { error: "Je mag geen coachnotities beheren." };
    }
    const parsed = notePayload.safeParse(proposal.payload);
    if (!parsed.success) return { error: "Ongeldige notitie-inhoud." };
    if (!(await memberBelongsToTenant(me.tenantId, userId))) {
      return { error: "Lid niet gevonden." };
    }

    // Hergebruik de bestaande, geaudite coachnotitie-action (audit `coachnote.add`).
    const fd = new FormData();
    fd.set("memberId", userId);
    fd.set("body", parsed.data.body);
    await addCoachNote(fd);
    return { ok: true };
  }

  return { error: "Onbekende actie." };
}
