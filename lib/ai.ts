import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { applySafetyGuardrail, SAFETY_FALLBACK } from "@/lib/ai-guardrail";

// Default op het meest capabele model; overschrijfbaar via env (bv. een
// goedkoper/sneller model zoals claude-haiku-4-5) — dat is een keuze van de
// eigenaar, niet van de code.
const MODEL = process.env.AI_MODEL ?? "claude-opus-4-8";

export type AssistantContext = {
  tenantName: string;
  machines: { name: string; type: string }[];
  exercises: string[];
  schema:
    | { name: string; items: { exercise: string; sets: number; reps: number }[] }
    | null;
};

/** Is de Anthropic-API geconfigureerd? */
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function buildSystemPrompt(ctx: AssistantContext): string {
  const machineList =
    ctx.machines.map((m) => `- ${m.name} (${m.type})`).join("\n") || "(geen)";
  const exerciseList = ctx.exercises.join(", ") || "(geen)";
  const schema = ctx.schema
    ? `Het huidige schema van de sporter heet "${ctx.schema.name}" en bevat: ` +
      ctx.schema.items
        .map((i) => `${i.exercise} ${i.sets}×${i.reps}`)
        .join(", ")
    : "De sporter heeft (nog) geen toegewezen schema.";

  return [
    `Je bent de trainingsassistent van sportschool "${ctx.tenantName}".`,
    "Geef NOOIT een medische diagnose. Bij pijn, blessure of medische twijfel:",
    "stuur de sporter altijd door naar een professional (trainer, fysiotherapeut of arts).",
    "Beperk je antwoorden tot oefeningen en apparatuur die in déze sportschool",
    "beschikbaar zijn (lijst hieronder). Verwijs niet naar apparatuur die er niet staat.",
    "Antwoord in dezelfde taal als de vraag. Houd het kort, praktisch en motiverend.",
    "",
    "Beschikbare apparatuur:",
    machineList,
    "",
    `Beschikbare oefeningen: ${exerciseList}`,
    "",
    schema,
  ].join("\n");
}

export async function askGymAssistant(
  question: string,
  ctx: AssistantContext
): Promise<string> {
  if (!aiConfigured()) {
    return "De AI-assistent is nog niet geconfigureerd. Vraag de eigenaar om een API-sleutel in te stellen.";
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(ctx),
      messages: [{ role: "user", content: question }],
      // EU data-residency (GymRebel-eis: geen data buiten de EU).
      inference_geo: "eu",
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal") {
      return SAFETY_FALLBACK;
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return applySafetyGuardrail(text);
  } catch {
    return "Er ging iets mis met de assistent. Probeer het later opnieuw.";
  }
}
