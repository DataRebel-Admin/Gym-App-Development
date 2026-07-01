import { z } from "zod";

/**
 * Gedeelde registry voor de "Contact opnemen"-functie (owner → platform-support).
 * Puur (géén server-only) → bruikbaar in de client-modal én de server-action.
 * De `label`s hier zijn de NL-fallback voor de e-mail (platform-mail = NL); de
 * UI toont vertaalde labels via next-intl (namespace `owner.support`).
 *
 * Uitbreidbaar: een extra categorie/prioriteit = één record erbij. De structuur
 * (getypeerde velden + Zod) is voorbereid op latere uitbreiding met o.a. een
 * ticketnummer of bestandsbijlagen.
 */

export const SUPPORT_CATEGORIES = [
  { value: "general", label: "Algemene vraag" },
  { value: "technical", label: "Technisch probleem" },
  { value: "feature", label: "Featureverzoek" },
  { value: "billing", label: "Facturatie" },
  { value: "other", label: "Overig" },
] as const;

export const SUPPORT_PRIORITIES = [
  { value: "low", label: "Laag" },
  { value: "normal", label: "Normaal" },
  { value: "high", label: "Hoog" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number]["value"];

const CATEGORY_VALUES = SUPPORT_CATEGORIES.map((c) => c.value) as [
  SupportCategory,
  ...SupportCategory[],
];
const PRIORITY_VALUES = SUPPORT_PRIORITIES.map((p) => p.value) as [
  SupportPriority,
  ...SupportPriority[],
];

/** NL-label voor een categorie (fallback voor de e-mail). */
export function supportCategoryLabel(value: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** NL-label voor een prioriteit (fallback voor de e-mail). */
export function supportPriorityLabel(value: string): string {
  return SUPPORT_PRIORITIES.find((p) => p.value === value)?.label ?? value;
}

/** Validatie voor een ingediend contactbericht (externe input). */
export const supportMessageSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
  category: z.enum(CATEGORY_VALUES).default("general"),
  priority: z.enum(PRIORITY_VALUES).default("normal"),
});

export type SupportMessageInput = z.infer<typeof supportMessageSchema>;
