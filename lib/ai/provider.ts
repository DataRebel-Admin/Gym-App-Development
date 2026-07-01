import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * Provider-laag van de AI Coach & Assistant. Eén plek die het daadwerkelijke model
 * aanroept — omschakelbaar via env, zonder code-wijziging:
 *   AI_PROVIDER=anthropic  → Claude (default; EU data-residency via inference_geo)
 *   AI_PROVIDER=openai     → OpenAI / ChatGPT (optioneel EU/Azure via OPENAI_BASE_URL)
 *
 * Alle oppervlakken (member-home, oefening, ledenprofiel, …) delen deze laag via
 * `callModel`. De system-prompt + context worden per oppervlak opgebouwd in
 * `lib/ai/surfaces/*` en door `lib/ai/assist.ts` samengevoegd.
 */

const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

// Modellen per provider (overschrijfbaar; AI_MODEL blijft als legacy-fallback voor Claude).
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? process.env.AI_MODEL ?? "claude-opus-4-8";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

/** Is de actieve AI-provider geconfigureerd (juiste API-key aanwezig)? */
export function aiConfigured(): boolean {
  if (PROVIDER === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ModelMessage = { role: "user" | "assistant"; content: string };

export type CallModelInput = {
  system: string;
  messages: ModelMessage[];
  maxTokens?: number;
};

/** Claude (Anthropic). Retourneert de tekst, of null bij een safety-refusal. */
async function callAnthropic({
  system,
  messages,
  maxTokens,
}: CallModelInput): Promise<string | null> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens ?? 1024,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
async function callOpenAI({
  system,
  messages,
  maxTokens,
}: CallModelInput): Promise<string> {
  // OPENAI_BASE_URL maakt een EU/Azure-endpoint mogelijk (data-residency).
  const client = new OpenAI(
    process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}
  );
  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...messages.map(
      (m): OpenAI.Chat.Completions.ChatCompletionMessageParam =>
        m.role === "assistant"
          ? { role: "assistant", content: m.content }
          : { role: "user", content: m.content }
    ),
  ];
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: maxTokens ?? 1024,
    messages: chatMessages,
  });
  return completion.choices[0]?.message?.content ?? "";
}

/**
 * Roep het model aan met een samengestelde system-prompt + berichten. Retourneert de
 * tekst, of `null` bij een safety-refusal (alleen Claude signaleert dit expliciet).
 */
export async function callModel(input: CallModelInput): Promise<string | null> {
  if (PROVIDER === "openai") return callOpenAI(input);
  return callAnthropic(input);
}
