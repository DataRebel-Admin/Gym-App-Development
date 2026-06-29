import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { applySafetyGuardrail, SAFETY_FALLBACK } from "@/lib/ai-guardrail";

// Welke AI-provider gebruiken we? Omschakelbaar via env zonder code-wijziging.
//   AI_PROVIDER=anthropic  → Claude (default; EU data-residency via inference_geo)
//   AI_PROVIDER=openai     → OpenAI / ChatGPT
const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

// Modellen per provider (overschrijfbaar; AI_MODEL blijft als legacy-fallback voor Claude).
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? process.env.AI_MODEL ?? "claude-opus-4-8";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export type AssistantContext = {
  tenantName: string;
  machines: { name: string; type: string }[];
  exercises: string[];
  schema:
    | { name: string; items: { exercise: string; sets: number; reps: number }[] }
    | null;
};

/** Is de actieve AI-provider geconfigureerd (juiste API-key aanwezig)? */
export function aiConfigured(): boolean {
  if (PROVIDER === "openai") return Boolean(process.env.OPENAI_API_KEY);
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

/** Claude (Anthropic). Retourneert de tekst, of null bij een safety-refusal. */
async function askAnthropic(
  question: string,
  system: string
): Promise<string | null> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: question }],
    // EU data-residency (GymRebel-eis: geen data buiten de EU).
    inference_geo: "eu",
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") return null;

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** OpenAI / ChatGPT (chat completions). */
async function askOpenAI(question: string, system: string): Promise<string> {
  // OPENAI_BASE_URL maakt een EU/Azure-endpoint mogelijk (data-residency).
  const client = new OpenAI(
    process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}
  );
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: system },
      { role: "user", content: question },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

export async function askGymAssistant(
  question: string,
  ctx: AssistantContext
): Promise<string> {
  if (!aiConfigured()) {
    return "De AI-assistent is nog niet geconfigureerd. Vraag de eigenaar om een API-sleutel in te stellen.";
  }

  const system = buildSystemPrompt(ctx);

  try {
    let text: string;
    if (PROVIDER === "openai") {
      text = await askOpenAI(question, system);
    } else {
      const result = await askAnthropic(question, system);
      if (result === null) return SAFETY_FALLBACK; // Claude safety-refusal
      text = result;
    }
    return applySafetyGuardrail(text);
  } catch {
    return "Er ging iets mis met de assistent. Probeer het later opnieuw.";
  }
}
