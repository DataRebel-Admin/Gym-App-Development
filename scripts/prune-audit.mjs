/**
 * Retentie + archivering van auditlogs (idempotent).
 *
 * Verwijdert auditlog-regels ouder dan AUDIT_RETENTION_DAYS (default 365) en
 * exporteert ze eerst naar een CSV-archief in ./audit-archive/.
 *
 * Lokaal: `npm run audit:prune`
 * Productie: als cron-stap draaien (zoals db:rls), na de deploy.
 * Override: `AUDIT_RETENTION_DAYS=30 npm run audit:prune`
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? "365");
const BATCH = 5000;

function csvField(v) {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  "id", "createdAt", "actorEmail", "actorRole", "tenantId", "action",
  "category", "status", "targetType", "targetId", "oldValue", "newValue",
  "ipAddress", "userAgent", "metadata",
];

async function main() {
  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) {
    console.error("AUDIT_RETENTION_DAYS moet een positief getal zijn.");
    process.exit(1);
  }
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  console.log(`Retentie: ${RETENTION_DAYS} dagen → verwijder logs vóór ${cutoff.toISOString()}`);

  const total = await prisma.auditLog.count({ where: { createdAt: { lt: cutoff } } });
  if (total === 0) {
    console.log("Niets te archiveren. Klaar.");
    return;
  }
  console.log(`${total} regels te archiveren…`);

  const dir = join(process.cwd(), "audit-archive");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `audit-${new Date().toISOString().slice(0, 10)}-${Date.now()}.csv`);

  const lines = [HEADERS.join(",")];
  let archived = 0;

  // Batch-gewijs ophalen + archiveren, daarna verwijderen.
  for (;;) {
    const rows = await prisma.auditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      take: BATCH,
    });
    if (rows.length === 0) break;

    for (const r of rows) {
      lines.push(
        HEADERS.map((h) =>
          csvField(h === "createdAt" ? r.createdAt.toISOString() : r[h])
        ).join(",")
      );
    }
    const ids = rows.map((r) => r.id);
    await prisma.auditLog.deleteMany({ where: { id: { in: ids } } });
    archived += rows.length;
    console.log(`  … ${archived}/${total}`);
  }

  writeFileSync(file, "﻿" + lines.join("\r\n"), "utf8");
  console.log(`✓ ${archived} regels gearchiveerd naar ${file} en verwijderd.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
