// Pure machine-helpers (geen Prisma/server-only import) zodat dit ook in
// Client Components veilig te gebruiken is.

export const MACHINE_TYPES = [
  "CARDIO",
  "KRACHT",
  "VRIJE_GEWICHTEN",
  "OVERIG",
] as const;

export type MachineTypeValue = (typeof MACHINE_TYPES)[number];

export const MACHINE_TYPE_LABELS: Record<MachineTypeValue, string> = {
  CARDIO: "Cardio",
  KRACHT: "Kracht",
  VRIJE_GEWICHTEN: "Vrije gewichten",
  OVERIG: "Overig",
};

export function machineTypeLabel(type: string): string {
  return MACHINE_TYPE_LABELS[type as MachineTypeValue] ?? type;
}

/** Publieke (productie-)URL die in de QR-code wordt gecodeerd. */
export function machinePublicUrl(tenantSlug: string, qrToken: string): string {
  return `https://${tenantSlug}.gymrebel.app/m/${qrToken}`;
}
