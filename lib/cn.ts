/**
 * Lichte className-helper (geen externe dep). Filtert falsy waarden en
 * voegt de rest samen met spaties. Voldoende voor onze conditionele klassen.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
