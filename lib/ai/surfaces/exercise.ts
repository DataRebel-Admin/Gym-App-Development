import "server-only";
import { getExerciseDetail, getAlternativeExercises } from "@/lib/exercise";
import { baseSystemPreamble, outputContract, type Surface } from "./base";

/**
 * Oppervlak "exercise": contextbewuste hulp op de oefening-detailpagina (member én
 * owner). Informatief — uitleg, alternatieven (binnen déze sportschool) en techniek.
 * `ref` = het exercise-id. Geen proposals: het wijzigt geen data.
 */
export const exerciseSurface: Surface = {
  id: "exercise",
  roles: ["member", "coach"],
  suggestions: [
    "Leg deze oefening simpel uit.",
    "Welke alternatieven zijn er hier?",
    "Waar moet ik op letten qua techniek?",
  ],
  build: async ({ user, tenantName, ref }) => {
    if (!ref) return null;
    const detail = await getExerciseDetail(ref, user.tenantId, user.locale);
    if (!detail) return null;

    const alternatives = await getAlternativeExercises(user.tenantId, ref);
    const perspective =
      user.role === "coach"
        ? "De gebruiker is een coach. Geef ook coaching-tips en veelgemaakte fouten."
        : "De gebruiker is een sporter. Houd het praktisch en toegankelijk.";

    const system = [
      baseSystemPreamble(tenantName, user.locale),
      "",
      "CONTEXT — de oefening waar de gebruiker naar kijkt:",
      `Naam: ${detail.name}`,
      detail.primaryMuscle ? `Primaire spier: ${detail.primaryMuscle}` : "",
      detail.secondaryMuscles.length
        ? `Secundaire spieren: ${detail.secondaryMuscles.join(", ")}`
        : "",
      detail.equipment ? `Materiaal: ${detail.equipment}` : "",
      detail.category ? `Categorie: ${detail.category}` : "",
      detail.bodyPart ? `Lichaamsdeel: ${detail.bodyPart}` : "",
      detail.instructionsText ? `Instructie: ${detail.instructionsText}` : "",
      detail.steps.length ? `Stappen: ${detail.steps.join(" | ")}` : "",
      "",
      `Alternatieven in deze sportschool (zelfde spiergroep): ${
        alternatives.map((a) => a.name).join(", ") || "(geen bekend)"
      }`,
      "",
      perspective,
      "Help met uitleg, alternatieven en techniekaanwijzingen op basis van deze context.",
      outputContract([]),
    ]
      .filter(Boolean)
      .join("\n");

    return { system };
  },
};
