/**
 * Azure Translator-client (EU-regio) — gedeelde vertaallaag.
 *
 * Bewust géén `server-only`: wordt (nu) door scripts gebruikt en kan later door
 * een server-action hergebruikt worden. Idioom van lib/exercise-types.ts.
 *
 * Data-residency: de regio komt uit `AZURE_TRANSLATOR_REGION` (GymRebel gebruikt
 * `germanywestcentral`). Zonder key is vertalen simpelweg niet beschikbaar —
 * de aanroeper degradeert dan netjes (nooit hard falen).
 */

export type TranslatorConfig = {
  key: string;
  endpoint: string;
  region: string;
};

/** Config uit env, of null als vertalen niet beschikbaar/uitgezet is. */
export function azureTranslatorConfig(): TranslatorConfig | null {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  if (!key?.trim() || !region?.trim()) return null;
  const endpoint = (
    process.env.AZURE_TRANSLATOR_ENDPOINT ??
    "https://api.cognitive.microsofttranslator.com"
  ).replace(/\/+$/, "");
  return { key: key.trim(), endpoint, region: region.trim() };
}

/**
 * Verdeel teksten in chunks binnen de Azure-limieten (≤100 items, ≤50k tekens).
 * Retourneert index-behoudende chunks zodat de aanroeper 1-op-1 kan terugmappen.
 */
export function chunkTexts(
  texts: string[],
  maxItems = 90,
  maxChars = 45_000
): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let curChars = 0;
  for (const t of texts) {
    const len = t.length;
    // Eén fragment dat zelf al te groot is krijgt zijn eigen chunk (Azure kapt
    // dan af i.p.v. de hele batch te weigeren).
    if (cur.length > 0 && (cur.length >= maxItems || curChars + len > maxChars)) {
      chunks.push(cur);
      cur = [];
      curChars = 0;
    }
    cur.push(t);
    curChars += len;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type TranslateOptions = {
  from: string;
  to: string;
  /** Pauze tussen chunks (ms) — proactief pacen tegen rate-limits (F0 is streng). */
  paceMs?: number;
  /** Voortgangs-callback: (klaar, totaal). */
  onProgress?: (done: number, total: number) => void;
};

/**
 * Vertaal een lijst teksten; de uitvoer is index-op-index gelijk aan de invoer.
 * 429/5xx wordt met exponentiële backoff opnieuw geprobeerd (max 6 pogingen).
 * Lege strings gaan niet naar de API (blijven leeg) — scheelt quota.
 */
export async function translateTexts(
  texts: string[],
  cfg: TranslatorConfig,
  { from, to, paceMs = 400, onProgress }: TranslateOptions
): Promise<string[]> {
  const result = new Array<string>(texts.length).fill("");

  // Alleen niet-lege fragmenten vertalen; onthoud hun oorspronkelijke index.
  const indices: number[] = [];
  const payload: string[] = [];
  texts.forEach((t, i) => {
    if (t.trim() === "") return;
    indices.push(i);
    payload.push(t);
  });
  if (payload.length === 0) return result;

  const url = `${cfg.endpoint}/translate?api-version=3.0&from=${from}&to=${to}`;
  const chunks = chunkTexts(payload);
  let cursor = 0;
  let done = 0;

  for (const chunk of chunks) {
    let attempt = 0;
    for (;;) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": cfg.key,
          "Ocp-Apim-Subscription-Region": cfg.region,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk.map((t) => ({ Text: t }))),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          translations: { text: string }[];
        }[];
        json.forEach((item, i) => {
          result[indices[cursor + i]] = item.translations[0]?.text ?? chunk[i];
        });
        cursor += chunk.length;
        done += chunk.length;
        onProgress?.(done, payload.length);
        if (paceMs > 0) await sleep(paceMs);
        break;
      }

      if ((res.status === 429 || res.status >= 500) && attempt < 6) {
        const wait = Math.min(2 ** attempt * 1000, 30_000);
        attempt++;
        await sleep(wait);
        continue;
      }
      throw new Error(`Azure Translator ${res.status}: ${await res.text()}`);
    }
  }

  return result;
}
