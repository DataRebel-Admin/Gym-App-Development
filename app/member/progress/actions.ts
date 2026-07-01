"use server";

import { revalidatePath } from "next/cache";
import type { PhotoPose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/member";
import { uploadProgressPhoto } from "@/lib/blob";

export type PhotoUploadState = { error?: string; ok?: boolean };

const POSES: PhotoPose[] = ["FRONT", "SIDE", "BACK"];

/**
 * Een lid uploadt zelf voortgangsfoto's. Hergebruikt het bestaande
 * `Measurement`/`MeasurementPhoto`-model: er wordt een lichte meting (alleen
 * foto's, geen lichaamswaarden) aangemaakt op de gekozen datum. De trainer ziet
 * deze foto's pas als het lid dat toestaat (privacy-voorkeur, default uit).
 */
export async function addProgressPhotos(
  _prev: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
  const member = await requireMember();

  const dateRaw = String(formData.get("measuredAt") ?? "");
  const measuredAt = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(measuredAt.getTime())) return { error: "Ongeldige datum" };

  const tenant = await prisma.tenant.findUnique({
    where: { id: member.tenantId },
    select: { slug: true },
  });
  if (!tenant) return { error: "Sportschool niet gevonden" };

  const photos: { pose: PhotoPose; url: string }[] = [];
  for (const pose of POSES) {
    const file = formData.get(`photo_${pose}`);
    if (file instanceof File && file.size > 0) {
      const url = await uploadProgressPhoto(file, tenant.slug);
      if (url) photos.push({ pose, url });
    }
  }
  if (photos.length === 0) {
    return { error: "Kies minstens één foto om te uploaden." };
  }

  await prisma.measurement.create({
    data: {
      tenantId: member.tenantId,
      userId: member.id,
      recordedById: member.id,
      measuredAt,
      source: "MANUAL",
      photos: {
        create: photos.map((p) => ({ tenantId: member.tenantId, pose: p.pose, url: p.url })),
      },
    },
  });

  revalidatePath("/member/progress");
  return { ok: true };
}
