import "server-only";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

/** Is Vercel Blob geconfigureerd? (Lokaal vaak niet.) */
export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
  const blob = await put(key, file, { access: "public" });
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
      const blob = await put(key, file, { access: "public" });
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
      const blob = await put(key, file, { access: "public" });
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
      const blob = await put(key, file, { access: "public" });
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
 * Upload een tenant-huisstijlasset (logo of favicon). Met Vercel Blob → publieke
 * URL; zonder token (lokaal) → een data-URL die direct in de DB/`<img>` past, zodat
 * branding overal werkt. Geeft een gerichte foutcode terug i.p.v. stil te falen.
 */
export async function uploadTenantAsset(
  file: File | null,
  tenantSlug: string,
  kind: "logo" | "favicon"
): Promise<AssetUploadResult> {
  if (!file || file.size === 0) return { error: "no-file" };
  if (!file.type.startsWith("image/")) return { error: "bad-type" };
  if (file.size > TENANT_ASSET_MAX_BYTES) return { error: "too-large" };

  try {
    if (blobConfigured()) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
      const key = `${tenantSlug}/branding/${kind}-${randomUUID()}.${ext}`;
      const blob = await put(key, file, { access: "public" });
      return { url: blob.url };
    }

    // Lokale fallback zonder Blob-token: base64 data-URL.
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/png";
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
    const blob = await put(key, file, { access: "public" });
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
    const blob = await put(key, file, { access: "public" });
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
      const blob = await put(key, file, { access: "public" });
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
