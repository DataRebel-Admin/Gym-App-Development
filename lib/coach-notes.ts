import "server-only";
import { prisma } from "@/lib/db";

export type CoachNoteRow = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
};

/** Coachnotities over een lid (vastgepind eerst, dan nieuwste). Tenant-scoped. */
export async function listCoachNotes(
  tenantId: string,
  memberId: string
): Promise<CoachNoteRow[]> {
  const notes = await prisma.coachNote.findMany({
    where: { tenantId, memberId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      body: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
      authorId: true,
      author: { select: { name: true, email: true } },
    },
  });
  return notes.map((n) => ({
    id: n.id,
    body: n.body,
    pinned: n.pinned,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    authorId: n.authorId,
    authorName: n.author?.name ?? null,
    authorEmail: n.author?.email ?? "",
  }));
}

/** Bevestigt dat een lid bij de tenant hoort (voor mutaties op het profiel). */
export async function memberBelongsToTenant(
  tenantId: string,
  memberId: string
): Promise<boolean> {
  const m = await prisma.user.findFirst({
    where: { id: memberId, tenantId },
    select: { id: true },
  });
  return Boolean(m);
}
