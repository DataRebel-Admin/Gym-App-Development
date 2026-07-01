// Kleine, pure deterministische keuze-helper. Zodat "toon steeds een andere"
// (herstelboodschap/quote) stabiel is per training (seed = sessionId) maar
// afwisselt tussen trainingen — zonder Math.random in een render (SSR-veilig).

/** Simpele, stabiele string-hash (FNV-1a-achtig). */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Kies deterministisch één item uit een lijst o.b.v. een seed. */
export function pickBySeed<T>(items: readonly T[], seed: string): T | null {
  if (items.length === 0) return null;
  return items[hashSeed(seed) % items.length];
}
