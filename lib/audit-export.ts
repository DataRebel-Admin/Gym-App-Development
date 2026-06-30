import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AuditLog } from "@prisma/client";
import { getActionDef } from "@/lib/audit-actions";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function jsonCell(v: unknown): string {
  if (v == null) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function csvField(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

const CSV_HEADERS = [
  "Tijdstip", "Gebruiker", "Rol", "Tenant", "Actie", "Categorie",
  "Status", "ObjectType", "ObjectId", "OudeWaarde", "NieuweWaarde", "IP", "Device",
];

/** Bouwt een CSV-string van auditlog-regels. */
export function auditRowsToCsv(
  logs: AuditLog[],
  tenantName?: Map<string, string>
): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const l of logs) {
    const cells = [
      DATE_FMT.format(l.createdAt),
      l.actorEmail ?? "",
      l.actorRole ?? "",
      l.tenantId ? (tenantName?.get(l.tenantId) ?? l.tenantId) : "platform",
      l.action,
      l.category ?? "",
      l.status,
      l.targetType ?? "",
      l.targetId ?? "",
      jsonCell(l.oldValue),
      jsonCell(l.newValue),
      l.ipAddress ?? "",
      l.userAgent ?? "",
    ];
    lines.push(cells.map((c) => csvField(c)).join(","));
  }
  return "﻿" + lines.join("\r\n"); // BOM voor Excel
}

const ascii = (s: string) =>
  s.replace(/×/g, "x").replace(/[–—]/g, "-").replace(/[^\x00-\x7F]/g, "");

function clip(s: string, max: number): string {
  const a = ascii(s);
  return a.length > max ? a.slice(0, max - 2) + ".." : a;
}

/** Bouwt een PDF (liggende A4-tabel) van auditlog-regels. */
export async function buildAuditPdf(
  logs: AuditLog[],
  opts: { title: string; tenantName?: Map<string, string>; showTenant?: boolean }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 841.89;
  const H = 595.28;
  const MARGIN = 36;
  const BLACK = rgb(0.1, 0.1, 0.1);
  const GRAY = rgb(0.45, 0.45, 0.45);
  const LINE = rgb(0.85, 0.85, 0.85);

  const cols = [
    { label: "Tijdstip", x: MARGIN, max: 18 },
    { label: "Gebruiker", x: MARGIN + 110, max: 28 },
    { label: "Actie", x: MARGIN + 290, max: 30 },
    { label: "Status", x: MARGIN + 470, max: 8 },
    { label: opts.showTenant ? "Tenant" : "Object", x: MARGIN + 540, max: 30 },
  ];

  let page = doc.addPage([W, H]);
  let y = H - MARGIN;

  const header = () => {
    page.drawText(ascii(opts.title), { x: MARGIN, y: y, size: 16, font: bold, color: BLACK });
    y -= 24;
    for (const c of cols) {
      page.drawText(c.label, { x: c.x, y, size: 9, font: bold, color: GRAY });
    }
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 0.5, color: LINE });
    y -= 14;
  };
  header();

  for (const l of logs) {
    if (y < MARGIN + 20) {
      page = doc.addPage([W, H]);
      y = H - MARGIN;
      header();
    }
    const def = getActionDef(l.action);
    const tenantCell = opts.showTenant
      ? (l.tenantId ? (opts.tenantName?.get(l.tenantId) ?? l.tenantId) : "platform")
      : `${l.targetType ?? ""}`;
    const values = [
      DATE_FMT.format(l.createdAt),
      l.actorEmail ?? "-",
      def.label,
      l.status === "FAILED" ? "Mislukt" : "OK",
      tenantCell,
    ];
    values.forEach((v, i) => {
      page.drawText(clip(v, cols[i].max), {
        x: cols[i].x,
        y,
        size: 8.5,
        font,
        color: l.status === "FAILED" ? rgb(0.7, 0.1, 0.1) : BLACK,
      });
    });
    y -= 16;
  }

  return doc.save();
}
