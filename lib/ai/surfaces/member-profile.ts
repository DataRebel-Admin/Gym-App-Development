import "server-only";
import { prisma } from "@/lib/db";
import { getMemberStats } from "@/lib/member-stats";
import { getDeltas, getGoals } from "@/lib/measurements";
import {
  baseSystemPreamble,
  outputContract,
  type ProposalSpec,
  type Surface,
} from "./base";

/** Proposal-soort: sla de AI-samenvatting op als coachnotitie (na bevestiging). */
export const SAVE_SUMMARY_NOTE = "save-summary-note";

const PROPOSAL_SPECS: ProposalSpec[] = [
  {
    kind: SAVE_SUMMARY_NOTE,
    when:
      "als de coach vraagt om de voortgang samen te vatten of om iets vast te leggen, stel dan voor die samenvatting als coachnotitie op te slaan.",
    payload: '{ "body": string (de notitie-tekst, max 5000 tekens) }',
  },
];

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/**
 * Oppervlak "member-profile" (vlaggenschip, coach-only): vat de voortgang van een lid
 * samen en doet suggesties. `ref` = het member-id. Kan een `save-summary-note`-proposal
 * teruggeven — die wijzigt pas data ná expliciete bevestiging via de apply-action.
 */
export const memberProfileSurface: Surface = {
  id: "member-profile",
  roles: ["coach"],
  suggestions: [
    "Vat de voortgang van dit lid samen.",
    "Wat verdient nu aandacht?",
    "Stel een schemafocus voor de komende weken voor.",
  ],
  build: async ({ user, tenantName, ref }) => {
    if (user.role !== "coach" || !ref) return null;

    // Verifieer dat het lid bij déze tenant hoort (app-side isolatie).
    const member = await prisma.user.findFirst({
      where: { id: ref, tenantId: user.tenantId, role: "TENANT_MEMBER" },
      select: { name: true, email: true },
    });
    if (!member) return null;

    const [stats, deltas, goals] = await Promise.all([
      getMemberStats(ref, user.tenantId),
      getDeltas(user.tenantId, ref),
      getGoals(user.tenantId, ref),
    ]);

    const topMuscles = stats.muscleGroups
      .slice(0, 4)
      .map((m) => `${m.muscle} (${m.pct}%)`)
      .join(", ");
    const deltaLines = deltas
      .filter((d) => d.current != null)
      .map((d) => `${d.label}: ${d.current}${d.unit}${d.delta != null ? ` (Δ ${d.delta > 0 ? "+" : ""}${d.delta})` : ""}`)
      .join("; ");
    const goalLines = goals
      .map((g) => `${g.metric}: ${g.current ?? "?"} → doel ${g.targetValue}${g.percent != null ? ` (${g.percent}%)` : ""}${g.achieved ? " ✓" : ""}`)
      .join("; ");
    const records = stats.records
      .slice(0, 4)
      .map((r) => `${r.name} ~${r.oneRm}kg 1RM`)
      .join(", ");

    const system = [
      baseSystemPreamble(tenantName),
      "",
      `CONTEXT — voortgang van lid "${member.name ?? member.email}" (alle cijfers zijn afgeleid; geen medische data):`,
      `Trainingen: ${stats.totalWorkouts} totaal, ${stats.workoutsThisWeek} deze week (weekdoel ${stats.weeklyGoal}), ${stats.workoutsThisMonth} deze maand.`,
      `Streak: ${stats.currentStreakWeeks} weken (langste ${stats.longestStreakWeeks}). Laatste sessie: ${fmtDate(stats.lastSessionAt)}.`,
      `Volume deze week: ${Math.round(stats.thisWeekVolume)} (totaal ${Math.round(stats.totalVolume)}).`,
      topMuscles ? `Meest getrainde spiergroepen (28d): ${topMuscles}.` : "",
      records ? `Sterkste oefeningen: ${records}.` : "",
      deltaLines ? `Recente metingen: ${deltaLines}.` : "Nog geen metingen vastgelegd.",
      goalLines ? `Doelen: ${goalLines}.` : "Nog geen doelen ingesteld.",
      "",
      "Geef een bondige, bruikbare coach-analyse: wat gaat goed, wat verdient aandacht, en een",
      "concrete suggestie. Baseer je uitsluitend op bovenstaande cijfers.",
      outputContract(PROPOSAL_SPECS),
    ]
      .filter(Boolean)
      .join("\n");

    return { system };
  },
};
