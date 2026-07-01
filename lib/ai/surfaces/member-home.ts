import "server-only";
import { prisma } from "@/lib/db";
import { getAssignedSchema } from "@/lib/member";
import { machineTypeLabel } from "@/lib/machine";
import { baseSystemPreamble, outputContract, type Surface } from "./base";

/**
 * Oppervlak "member-home": de bestaande sporter-assistent (chat-bubble op /member).
 * Context = apparatuur + oefeningen van déze sportschool + het toegewezen schema.
 * Puur informatief (geen proposals) — gedrag identiek aan de vorige widget.
 */
export const memberHomeSurface: Surface = {
  id: "member-home",
  roles: ["member"],
  suggestions: [
    "Wat is een goede warming-up voor mijn schema?",
    "Leg oefening X uit.",
    "Hoe blijf ik gemotiveerd deze week?",
  ],
  build: async ({ user, tenantName }) => {
    const [machines, exercises, assignment] = await Promise.all([
      prisma.machine.findMany({
        where: { tenantId: user.tenantId },
        select: { name: true, type: true },
      }),
      prisma.exercise.findMany({
        where: { tenantId: user.tenantId, archivedAt: null },
        select: { name: true },
      }),
      getAssignedSchema(user.id, user.tenantId),
    ]);

    const machineList =
      machines.map((m) => `- ${m.name} (${machineTypeLabel(m.type)})`).join("\n") ||
      "(geen)";
    const exerciseList = exercises.map((e) => e.name).join(", ") || "(geen)";
    const schema = assignment?.template
      ? `Het huidige schema van de sporter heet "${assignment.template.name}" en bevat: ` +
        assignment.template.items
          .map((it) => `${it.exercise.name} ${it.sets}×${it.reps}`)
          .join(", ")
      : "De sporter heeft (nog) geen toegewezen schema.";

    const system = [
      baseSystemPreamble(tenantName),
      "",
      "CONTEXT — beschikbare apparatuur:",
      machineList,
      "",
      `Beschikbare oefeningen: ${exerciseList}`,
      "",
      schema,
      outputContract([]),
    ].join("\n");

    return { system };
  },
};
