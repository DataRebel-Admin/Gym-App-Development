import "server-only";
import { getTranslations } from "next-intl/server";
import type { ZodError } from "zod";

/**
 * Sleutels in de `validation`-namespace (messages/*.json). Zod-schema's zetten
 * één van deze sleutels als custom `message`; hier vertalen we de eerste
 * gefaalde issue naar de UI-taal. Velden zónder expliciete sleutel (zod-
 * defaults, bv. `.min(1)` op een getal) vallen netjes terug op `invalidInput`.
 */
export type ValidationKey =
  | "nameRequired"
  | "invalidVideoUrl"
  | "invalidDate"
  | "actionRequired"
  | "endAfterStart"
  | "invalidInput";

const VALIDATION_KEYS: ValidationKey[] = [
  "nameRequired",
  "invalidVideoUrl",
  "invalidDate",
  "actionRequired",
  "endAfterStart",
  "invalidInput",
];

function isValidationKey(k: string | undefined): k is ValidationKey {
  return k !== undefined && (VALIDATION_KEYS as string[]).includes(k);
}

/**
 * Vertaal de eerste zod-issue-message (een `validation`-sleutel) naar de
 * UI-taal. Gebruik in server-actions: `return { error: await
 * firstValidationError(parsed.error) }`.
 */
export async function firstValidationError(error: ZodError): Promise<string> {
  const t = await getTranslations("validation");
  const key = error.issues[0]?.message;
  return isValidationKey(key) ? t(key) : t("invalidInput");
}
