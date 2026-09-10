import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publishDueAssignments } from "@/lib/schema-publish";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * Geplande publicatie van trainingsschema's. Publiceert toewijzingen met status
 * SCHEDULED zodra `availableFrom` is bereikt en stuurt de leden hun melding.
 *
 * Het echte werk staat in `lib/schema-publish.ts`, want er is een tweede pad:
 * de member-app publiceert bij het openen wat er voor dát lid klaarstaat. Dit
 * is het **vangnet** voor leden die de app niet openen — die moeten hun e-mail
 * en push wél krijgen. Beide paden claimen een rij met een `status`-filter in
 * de `updateMany`, dus tegelijk draaien kan geen dubbele publicatie of dubbele
 * melding opleveren.
 *
 * Op het Vercel Hobby-plan draait deze cron één keer per dag (zie commit
 * 0637e13 en de cron-sectie in CLAUDE.md); daarom bestaat het luie pad.
 *
 * Beveiliging: vereist `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron stuurt
 * deze header automatisch mee). Fail-closed in productie — zonder CRON_SECRET
 * wordt de route daar geweigerd (zie lib/cron-auth.ts). Zet 'm dus in productie.
 */
export const dynamic = "force-dynamic";

const BATCH = 500;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await prisma.assignedWorkout.findMany({
    where: { status: "SCHEDULED", availableFrom: { lte: new Date() } },
    select: { id: true, tenantId: true, userId: true },
    take: BATCH,
  });

  const result = await publishDueAssignments(due);
  return NextResponse.json(result);
}
