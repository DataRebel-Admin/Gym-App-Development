import "server-only";
import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { libraryMediaBaseUrl } from "@/lib/exercise-library/media";

/**
 * Token van de Blob-store.
 *
 * Vercel zet bij het koppelen standaard `BLOB_READ_WRITE_TOKEN`, en dát is de
 * enige naam die `@vercel/blob` zelf kent. Onze store is gekoppeld met het
 * prefix `GYMBLOB_`, dus zonder deze helper ziet de SDK geen opslag en falen
 * álle uploads stil. Daarom lezen we beide namen en geven we de token expliciet
 * mee aan `put()`/`del()`.
 *
 * De standaardnaam wint bewust: koppel je de store later opnieuw zónder prefix,
 * dan werkt dat vanzelf en hoeft hier niets terug.
 */
export function blobToken(): string | undefined {
  return (
    process.env.BLOB_READ_WRITE_TOKEN || process.env.GYMBLOB_READ_WRITE_TOKEN || undefined
  );
}

/** Is Vercel Blob geconfigureerd? (Lokaal vaak niet.) */
export function blobConfigured(): boolean {
  return Boolean(blobToken());
}

/**
 * Terugval-opslag: de **eigen publieke mediacontainer** (dezelfde bron als de
 * oefening-media, afgeleid uit `LIBRARY_MEDIA_BASE_URL`).
 *
 * **Waarom dit bestaat.** Zonder Vercel Blob-token viel een tenant-logo terug op
 * een base64 `data:`-URL. In de app ziet dat er perfect uit (rauwe `<img>`), maar
 * Gmail en Outlook blokkeren `data:`-URL's, dus verdween het logo uit élke e-mail
 * terwijl de upload geslaagd léék — een sportschool kon blijven her-uploaden
 * zonder ooit resultaat te zien. Een echte https-URL werkt overal: app, e-mail,
 * PDF en QR-labels.
 *
 * Alleen voor bestanden die publiek mógen zijn (huisstijl). Een screenshot of
 * defectfoto hoort hier níét — die blijven achter een beschermde route.
 *
 * Geeft `null` zodra iets ontbreekt of misgaat; de aanroeper kiest zelf het
 * volgende redmiddel (dit mag een upload nooit laten mislukken).
 */
export async function putPublicMedia(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string | null> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) return null;

  try {
    const base = libraryMediaBaseUrl();
    // Containernaam uit de publieke basis-URL (zelfde afleiding als
    // scripts/upload-schema-images.ts) — nooit uit AZURE_BLOB_CONTAINER, dat
    // wijst bewust naar de verouderde legacy-container.
    const container = new URL(base).pathname.replace(/^\/+|\/+$/g, "");
    if (!container || container.includes("/")) return null;

    // Lui geïmporteerd: de Azure-SDK hoort niet in de module-graaf van elke
    // server-action die toevallig lib/blob.ts aanraakt.
    const { BlobServiceClient } = await import("@azure/storage-blob");
    const service = BlobServiceClient.fromConnectionString(connectionString);
    const blob = service.getContainerClient(container).getBlockBlobClient(key);
    await blob.uploadData(data, { blobHTTPHeaders: { blobContentType: contentType } });
    return `${base}/${key}`;
  } catch {
    return null;
  }
}

/**
 * Sleutel voor een huisstijlbestand in de publieke container. **`images/`-prefix
 * is verplicht**: de licentie van de oefeningen-bundel eist dat die container
 * uitsluitend `images/**` bevat (de ruwe dataset staat in de privé-container).
 * Eigen map naast `images/schema-templates/` — dit is geen RepDB-materiaal.
 */
function tenantBrandingKey(tenantSlug: string, filename: string): string {
  return `images/tenant-branding/${tenantSlug}/${filename}`;
}

/**
 * Verwijder een bestand uit de eigen Vercel Blob-store (best-effort, AVG-
 * opschoning). Accepteert alléén URL's van de eigen store: `User.image` kan
 * óók een externe OAuth-avatar of een lokale data-URL zijn, en die horen hier
 * nooit langs te komen. Een falende delete breekt de aanroepende flow nooit —
 * opslag-opschoning mag een accountactie of cron-run niet blokkeren.
 */
export async function deleteOwnBlob(url: string | null | undefined): Promise<void> {
  if (!url || !blobConfigured()) return;
  if (!/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url)) return;
  try {
    await del(url, { token: blobToken() });
  } catch {
    // Best-effort: de blob blijft dan hangen, maar de flow gaat door.
  }
}

/**
 * Upload een machine-foto naar Vercel Blob en geef de publieke URL terug.
 * Retourneert null wanneer er geen bestand is of Blob niet geconfigureerd is
 * (zodat create/update lokaal blijft werken zonder token).
 */
export async function uploadMachineImage(
  file: File | null,
  tenantSlug: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!blobConfigured()) return null;

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const key = `${tenantSlug}/machines/${randomUUID()}.${ext}`;
  const blob = await put(key, file, { access: "public", token: blobToken() });
  return blob.url;
}

/** Maximale grootte van een oefening-afbeelding (5 MB). */
export const EXERCISE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload één afbeelding van een eigen oefening. Met Vercel Blob → publieke URL;
 * zonder token (lokaal) → een data-URL zodat afbeeldingen ook lokaal werken.
 * Geeft null terug bij ongeldige/te grote/lege invoer (caller filtert die eruit).
 */
export async function uploadExerciseImage(
  file: File | null,
  tenantSlug: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/")) return null;
  if (file.size > EXERCISE_IMAGE_MAX_BYTES) return null;

  try {
    if (blobConfigured()) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const key = `${tenantSlug}/exercises/${randomUUID()}.${ext}`;
      const blob = await put(key, file, { access: "public", token: blobToken() });
      return blob.url;
    }

    // Lokale fallback zonder Blob-token: base64 data-URL.
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Maximale grootte van een voortgangsfoto (8 MB). */
export const PROGRESS_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Upload een voortgangsfoto (Body Composition). Met Vercel Blob → publieke URL;
 * zonder token → base64 data-URL (werkt lokaal/zonder token, wel zwaar in de DB).
 * Retourneert null bij geen/te groot/ongeldig bestand.
 */
export async function uploadProgressPhoto(
  file: File | null,
  tenantSlug: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/")) return null;
  if (file.size > PROGRESS_PHOTO_MAX_BYTES) return null;

  try {
    if (blobConfigured()) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const key = `${tenantSlug}/progress/${randomUUID()}.${ext}`;
      const blob = await put(key, file, { access: "public", token: blobToken() });
      return blob.url;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Maximale grootte van een omslagfoto bij een schema (5 MB). */
export const SCHEMA_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload de eigen omslagfoto van een trainingsschema. Met Vercel Blob →
 * publieke URL; zonder token (lokaal) → een data-URL, zodat het beeld ook
 * zonder Blob-configuratie werkt (patroon uploadExerciseImage). Retourneert
 * null bij lege/ongeldige/te grote invoer: de caller laat het schema dan
 * gewoon terugvallen op de herkomst-foto of het sportschoollogo.
 */
export async function uploadSchemaImage(
  file: File | null,
  tenantSlug: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/")) return null;
  if (file.size > SCHEMA_IMAGE_MAX_BYTES) return null;

  try {
    if (blobConfigured()) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const key = `${tenantSlug}/schemas/${randomUUID()}.${ext}`;
      const blob = await put(key, file, { access: "public", token: blobToken() });
      return blob.url;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Upload de omslagfoto van een lestype. Zelfde keten en dezelfde grens als
 * `uploadSchemaImage` — het is hetzelfde soort beeld, alleen bij een les.
 */
export async function uploadClassImage(
  file: File | null,
  tenantSlug: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/")) return null;
  if (file.size > SCHEMA_IMAGE_MAX_BYTES) return null;

  try {
    if (blobConfigured()) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const key = `${tenantSlug}/classes/${randomUUID()}.${ext}`;
      const blob = await put(key, file, { access: "public", token: blobToken() });
      return blob.url;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Maximale grootte van een logo/favicon (2 MB). */
export const TENANT_ASSET_MAX_BYTES = 2 * 1024 * 1024;

export type AssetUploadResult =
  | { url: string }
  | { error: "no-file" | "too-large" | "bad-type" | "failed" };

/**
 * Upload een tenant-huisstijlasset (logo of favicon).
 *
 * **Het resultaat moet een échte URL zijn**, want dit bestand belandt ook in
 * e-mails, PDF's en QR-labels — buiten de browser om. Vandaar de keten:
 * Vercel Blob → eigen publieke mediacontainer (`putPublicMedia`) → pas als
 * laatste redmiddel een `data:`-URL. Die laatste werkt alleen ín de app; de
 * guard in `lib/email/branding.ts` vervangt 'm in mail door het tekst-wordmerk,
 * zodat de ontvanger nooit een gebroken afbeelding ziet.
 *
 * Geeft een gerichte foutcode terug i.p.v. stil te falen.
 */
export async function uploadTenantAsset(
  file: File | null,
  tenantSlug: string,
  kind: "logo" | "favicon"
): Promise<AssetUploadResult> {
  if (!file || file.size === 0) return { error: "no-file" };
  if (!file.type.startsWith("image/")) return { error: "bad-type" };
  if (file.size > TENANT_ASSET_MAX_BYTES) return { error: "too-large" };

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const filename = `${kind}-${randomUUID()}.${ext}`;

  try {
    if (blobConfigured()) {
      const blob = await put(`${tenantSlug}/branding/${filename}`, file, {
        access: "public",
        token: blobToken(),
      });
      return { url: blob.url };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/png";

    const hosted = await putPublicMedia(
      tenantBrandingKey(tenantSlug, filename),
      buffer,
      mime
    );
    if (hosted) return { url: hosted };

    return { url: `data:${mime};base64,${buffer.toString("base64")}` };
  } catch {
    return { error: "failed" };
  }
}

/** Maximale grootte van een melding-screenshot (5 MB). */
export const REPORT_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

export type ReportScreenshotResult =
  | { url: string }
  | { error: "no-file" | "too-large" | "bad-type" | "unconfigured" | "failed" };

/**
 * Upload een screenshot bij een probleem-melding (AppReport). Bewust GÉÉN
 * data-URL-fallback: zonder Blob-token weigeren we de screenshot (de melding
 * zelf gaat gewoon door) — megabytes base64 in de DB is het niet waard. De
 * URL is onraadbaar (UUID) en komt nooit in de client; de superadmin bekijkt
 * de screenshot via de beschermde route /admin/meldingen/[id]/screenshot.
 */
export async function uploadReportScreenshot(
  file: File | null
): Promise<ReportScreenshotResult> {
  if (!file || file.size === 0) return { error: "no-file" };
  if (!file.type.startsWith("image/")) return { error: "bad-type" };
  if (file.size > REPORT_SCREENSHOT_MAX_BYTES) return { error: "too-large" };
  if (!blobConfigured()) return { error: "unconfigured" };

  try {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
    const key = `reports/screenshots/${randomUUID()}.${ext}`;
    const blob = await put(key, file, { access: "public", token: blobToken() });
    return { url: blob.url };
  } catch {
    return { error: "failed" };
  }
}

/** Maximale grootte van een defect-foto (5 MB). */
export const DEFECT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload een foto bij een apparaatdefect-melding. Bewust GÉÉN data-URL-fallback
 * (patroon uploadReportScreenshot): zonder Blob-token gaat de melding gewoon
 * door zonder foto. De URL is onraadbaar (UUID) en komt NOOIT naar de client;
 * staff bekijkt de foto via de beschermde route
 * /owner/defects/[id]/photo/[index] (AVG: geen publieke vindbare foto-URLs).
 */
export async function uploadDefectPhoto(
  file: File | null,
  tenantId: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/")) return null;
  if (file.size > DEFECT_PHOTO_MAX_BYTES) return null;
  if (!blobConfigured()) return null;

  try {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const key = `defects/${tenantId}/${randomUUID()}.${ext}`;
    const blob = await put(key, file, { access: "public", token: blobToken() });
    return blob.url;
  } catch {
    return null;
  }
}

/** Maximale grootte van een profielfoto (5 MB). */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export type AvatarUploadResult =
  | { url: string }
  | { error: "no-file" | "too-large" | "bad-type" | "failed" };

/**
 * Verwerk een profielfoto. Met Vercel Blob → publieke URL; zonder token
 * (lokaal) → een data-URL die direct in de DB/`<img>` past, zodat profielfoto's
 * overal werken. Geeft een gerichte foutcode terug i.p.v. stil te falen.
 */
export async function uploadAvatar(
  file: File | null,
  userId: string
): Promise<AvatarUploadResult> {
  if (!file || file.size === 0) return { error: "no-file" };
  if (!file.type.startsWith("image/")) return { error: "bad-type" };
  if (file.size > AVATAR_MAX_BYTES) return { error: "too-large" };

  try {
    if (blobConfigured()) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const key = `avatars/${userId}/${randomUUID()}.${ext}`;
      const blob = await put(key, file, { access: "public", token: blobToken() });
      return { url: blob.url };
    }

    // Lokale fallback zonder Blob-token: base64 data-URL.
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    return { url: `data:${mime};base64,${buffer.toString("base64")}` };
  } catch {
    return { error: "failed" };
  }
}
