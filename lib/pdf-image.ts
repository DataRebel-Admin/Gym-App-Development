import "server-only";
import type { PDFDocument, PDFImage } from "pdf-lib";
import { toAbsoluteUrl } from "@/lib/app-url";

/**
 * Externe afbeeldingen in een pdf-lib-document embedden — gedeeld door alle
 * PDF-bouwers (schema-PDF, QR-labels, …).
 *
 * WAAROM SHARP: pdf-lib kan uitsluitend **PNG en JPEG** embedden, terwijl onze
 * media dat vaak niet zijn: de oefeningen-bibliotheek (RepDB) is volledig
 * **WebP** (inclusief animaties), de klassieke catalogus heeft `.gif`, en eigen
 * uploads/logo's kunnen alles zijn. Sharp normaliseert daarom élke bron naar een
 * verkleinde PNG (bij een animatie het eerste frame). Sharp is een native
 * addon die Next zelf al meelevert voor beeldoptimalisatie; hij wordt **lui**
 * geïmporteerd en bij afwezigheid degradeert dit netjes (PNG/JPEG gaan dan nog
 * rauw door, de rest levert geen beeld op) — een PDF faalt nooit op een plaatje.
 */

export type EmbedImageOptions = {
  /** Langste zijde na verkleinen (px). Houdt het PDF-bestand klein. */
  maxPx?: number;
  /** Harde deadline per afbeelding, zodat een trage blob de download niet ophoudt. */
  timeoutMs?: number;
};

const isPng = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50;
const isJpg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

/** Normaliseert willekeurige beeldbytes naar een verkleinde PNG (of null). */
async function toPngBytes(bytes: Uint8Array, maxPx: number): Promise<Uint8Array | null> {
  try {
    const { default: sharp } = await import("sharp");
    const out = await sharp(bytes)
      .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

/** Haalt één URL op en embedt 'm. Faalt nooit hard — `null` = geen afbeelding. */
export async function embedRemoteImage(
  doc: PDFDocument,
  url: string,
  { maxPx = 160, timeoutMs = 5000 }: EmbedImageOptions = {}
): Promise<PDFImage | null> {
  try {
    // Een PDF wordt buiten de request-context opgebouwd, dus `/brand/logo.svg`
    // bestaat daar niet: eigen paden krijgen de app-origin ervoor.
    const res = await fetch(toAbsoluteUrl(url) ?? url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const raw = new Uint8Array(await res.arrayBuffer());
    if (raw.length === 0) return null;

    const png = await toPngBytes(raw, maxPx);
    if (png) return await doc.embedPng(png);
    // Zonder sharp: alleen de formaten die pdf-lib zelf begrijpt.
    if (isPng(raw)) return await doc.embedPng(raw);
    if (isJpg(raw)) return await doc.embedJpg(raw);
    return null;
  } catch {
    return null;
  }
}

/** Bovengrens op het aantal unieke afbeeldingen per document (kosten/tijd). */
const MAX_IMAGES = 80;
const CONCURRENCY = 6;

/**
 * Embedt een lijst URL's parallel (gededupliceerd) → `Map<url, PDFImage>`.
 * URL's die niet lukken staan simpelweg niet in de map, dus de aanroeper kan
 * per rij `map.get(url)` gebruiken als "is er beeld?"-check.
 */
export async function embedRemoteImages(
  doc: PDFDocument,
  urls: (string | null | undefined)[],
  opts: EmbedImageOptions = {}
): Promise<Map<string, PDFImage>> {
  const unique = [
    ...new Set(urls.filter((u): u is string => typeof u === "string" && u.trim() !== "")),
  ].slice(0, MAX_IMAGES);

  const out = new Map<string, PDFImage>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, unique.length) }, async () => {
      while (next < unique.length) {
        const url = unique[next++];
        const img = await embedRemoteImage(doc, url, opts);
        if (img) out.set(url, img);
      }
    })
  );
  return out;
}
