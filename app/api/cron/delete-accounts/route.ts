import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { audit } from "@/lib/audit";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/constants";
import { releaseMemberClassSpots } from "@/lib/class-enrollment";
import { deleteOwnBlob } from "@/lib/blob";

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
 * verwijder-registratie. Buiten de cascade om worden ook opgeruimd: AiUsage
 * (geen user-FK) en de Vercel Blob-bestanden van profielfoto en
 * voortgangsfoto's (opslag cascadeert niet mee met de DB).
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
    select: { id: true, email: true, role: true, tenantId: true, image: true },
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
      // AiUsage heeft bewust géén user-FK (metering) en cascadeert dus niet
      // mee — expliciet opruimen, anders blijven rijen met een dood userId
      // achter (zelfde afweging als ReportQuota).
      await prisma.aiUsage.deleteMany({ where: { userId: u.id } });
      // Blob-opschoning: profielfoto en voortgangsfoto's staan in Vercel Blob
      // en cascaden niet mee met de DB-delete. URL's vóór de delete verzamelen
      // (daarna zijn de rijen weg), blobs pas ná de geslaagde delete opruimen.
      const progressPhotoUrls = (
        await prisma.measurementPhoto.findMany({
          where: { measurement: { userId: u.id } },
          select: { url: true },
        })
      ).map((p) => p.url);
      // Vóór de delete: de cascade wist les-aanmeldingen zonder dat de
      // wachtlijst doorschuift — plekken eerst vrijgeven (best-effort).
      if (u.tenantId) await releaseMemberClassSpots(u.tenantId, u.id);
      await prisma.user.delete({ where: { id: u.id } });
      deleted++;
      // Best-effort: deleteOwnBlob filtert data-URL's/externe URL's er zelf
      // uit en faalt nooit hard.
      for (const url of [u.image, ...progressPhotoUrls]) await deleteOwnBlob(url);
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
