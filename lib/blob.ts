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

/** Upload een profielfoto naar Vercel Blob en geef de publieke URL terug. */
export async function uploadAvatar(
  file: File | null,
  userId: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!blobConfigured()) return null;

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const key = `avatars/${userId}/${randomUUID()}.${ext}`;
  const blob = await put(key, file, { access: "public" });
  return blob.url;
}
