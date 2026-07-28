// Beperkte, zinnige tijdzone-set voor sportschool-vestigingen (puur — ook
// client-bruikbaar voor de vestiging-form). Uitbreiden = een regel toevoegen;
// de uur-bucketing (lib/metrics/definitions.ts) accepteert elke IANA-zone.
export const LOCATION_TIMEZONES = [
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
] as const;

export type LocationTimezone = (typeof LOCATION_TIMEZONES)[number];
