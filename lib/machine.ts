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

/**
 * Basisdomein voor tenant-subdomeinen. `NEXT_PUBLIC_` omdat deze helper bewust
 * ook in Client Components bruikbaar is (een server-only var zou daar stil
 * `undefined` opleveren).
 */
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "gymrebel-training.nl";

/**
 * Publieke (productie-)URL die in de QR-code wordt gecodeerd.
 *
 * ⚠️ Deze URL belandt op **fysiek geprinte** stickers bij de apparaten. Wijzigt
 * het domein, dan zijn alle eerder geprinte labels dood: houd het oude domein
 * dan draaiend met een redirect, of print opnieuw via de QR-bulkexport.
 */
export function machinePublicUrl(tenantSlug: string, qrToken: string): string {
  return `https://${tenantSlug}.${APP_DOMAIN}/m/${qrToken}`;
}

// Heuristiek: leid een MachineType af uit het vrije equipment-veld van de
// catalogus (bv. "barbell", "treadmill"). Een voorstel — de owner kan altijd
// bijsturen. Cardio-trefwoorden gaan vóór het generieke "machine" (anders zou
// "elliptical machine" als KRACHT eindigen).
const CARDIO_KEYWORDS = [
  "treadmill", "bike", "cycle", "elliptical", "stepmill", "stair",
  "skierg", "ergometer", "rower", "rowing",
];
const KRACHT_KEYWORDS = ["machine", "cable", "smith", "leverage", "sled", "hammer"];
const VRIJ_KEYWORDS = [
  "barbell", "dumbbell", "kettlebell", "weighted", "olympic", "ez ",
  "trap bar", "plate", "medicine ball", "band", "rope", "body weight",
  "bodyweight", "assisted", "stability ball", "wheel", "roller", "tire",
  "suspension",
];

export function suggestMachineType(equipment: string | null): MachineTypeValue {
  const e = (equipment ?? "").toLowerCase();
  if (CARDIO_KEYWORDS.some((k) => e.includes(k))) return "CARDIO";
  if (KRACHT_KEYWORDS.some((k) => e.includes(k))) return "KRACHT";
  if (VRIJ_KEYWORDS.some((k) => e.includes(k))) return "VRIJE_GEWICHTEN";
  return "OVERIG";
}
