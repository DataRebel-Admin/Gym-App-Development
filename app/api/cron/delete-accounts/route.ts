import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { audit } from "@/lib/audit";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/constants";
import { releaseMemberClassSpots } from "@/lib/class-enrollment";

/**
 * Definitieve accountverwijdering na de uitstelperiode. Verwijdert gebruikers die
 * hun account ≥ ACCOUNT_DELETION_GRACE_DAYS geleden in-app hebben laten verwijderen
 * en het niet hebben geannuleerd. Voldoet aan Apple 5.1.1(v): self-service,
 * automatisch, geen admin-tussenstap.
 *
 * `prisma.user.delete` cascadeert alle eigen data (sessies/prestaties/metingen/
 * doelen/passkeys/vestiging-koppelingen/…); historische records met de gebruiker
 * als *actor* (onderhoud, apparaat-scans) worden ge-SetNull i.p.v. verwijderd.
 * Het (FK-loze, forensische) AuditLog blijft bestaan — inclusief deze
 * verwijder-registratie.
 *
 * Vestigingen (geverifieerd na de Organisatie→Vestigingen-migratie): de
 * Restrict-FK's op locationId blokkeren alléén het verwijderen van een
 * Location, nooit deze user-delete — sessies/aanmeldingen cascaden gewoon via
 * de gebruiker. StaffLocationAccess.userId = Cascade; ClassEnrollment.markedById
 * en EarnedAchievement.locationId zijn FK-loos; User.homeLocationId staat op de
 * te verwijderen rij zelf.
 *
 * Beveiliging: Bearer CRON_SECRET (fail-closed in productie). Draait dagelijks
 * (zie vercel.json). Best-effort per gebruiker: een fout blokkeert de rest niet.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const due = await prisma.user.findMany({
    where: { deletionRequestedAt: { not: null, lte: cutoff } },
    select: { id: true, email: true, role: true, tenantId: true },
  });

  let deleted = 0;
  for (const u of due) {
    try {
      // App-meldingen zijn FK-loos (forensisch, zoals AuditLog): de inhoud
      // blijft, de persoonslink wordt verbroken. Quota-rijen zijn puur
      // persoonsgebonden administratie en gaan volledig weg.
      await prisma.appReport.updateMany({
        where: { reportedById: u.id },
        data: { reportedById: null },
      });
      await prisma.reportQuota.deleteMany({ where: { userId: u.id } });
      // Vóór de delete: de cascade wist les-aanmeldingen zonder dat de
      // wachtlijst doorschuift — plekken eerst vrijgeven (best-effort).
      if (u.tenantId) await releaseMemberClassSpots(u.tenantId, u.id);
      await prisma.user.delete({ where: { id: u.id } });
      deleted++;
      await audit("account.deletion.completed", {
        actor: { id: u.id, email: u.email, role: u.role },
        tenantId: u.tenantId,
        targetType: "User",
        targetId: u.id,
        metadata: { graceDays: ACCOUNT_DELETION_GRACE_DAYS },
      });
    } catch (err) {
      console.error("[cron] accountverwijdering mislukt:", u.id, (err as Error).message);
    }
  }

  return NextResponse.json({ due: due.length, deleted });
}
