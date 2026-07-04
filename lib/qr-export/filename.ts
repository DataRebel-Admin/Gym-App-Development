// Pure bestandsnaam-helpers voor de ZIP-export. Levert nette, deterministische
// namen als `Chest-Press-02.png` en voorkomt collisions bij dubbele apparaatnamen.

/** Slugt een apparaatnaam naar een veilig bestandsnaam-fragment. */
export function safeFilename(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accenten strippen
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "apparaat";
}

/** `Chest-Press-02.png` — nummer 2-cijferig gepad (of breder bij >99). */
export function numberedFilename(name: string, index: number, ext: string): string {
  const width = Math.max(2, String(index).length);
  const num = String(index).padStart(width, "0");
  return `${safeFilename(name)}-${num}.${ext}`;
}

/**
 * Maakt een lijst bestandsnamen uniek: bij een botsing wordt een oplopende
 * suffix toegevoegd (`Loopband-01.png`, `Loopband-01-2.png`).
 */
export function dedupeFilenames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const key = raw.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return raw;
    const dot = raw.lastIndexOf(".");
    if (dot <= 0) return `${raw}-${count + 1}`;
    return `${raw.slice(0, dot)}-${count + 1}${raw.slice(dot)}`;
  });
}
