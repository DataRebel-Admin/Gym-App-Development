import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { audit } from "@/lib/audit";
import {
  listMeasurements,
  getDeltas,
  getGoals,
  getSeries,
} from "@/lib/measurements";
import {
  COMPOSITION_METRICS,
  CIRCUMFERENCE_METRICS,
  GOAL_METRIC_LABEL,
  formatMetric,
} from "@/lib/measurement-meta";

/** Hex (#rrggbb) → pdf-lib rgb (0–1), met fallback op het GymRebel-accent. */
function hexColor(hex: string | null | undefined) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return rgb(0.91, 0.29, 0.12);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith("data:")) {
      const base64 = url.slice(url.indexOf(",") + 1);
      return Uint8Array.from(Buffer.from(base64, "base64"));
    }
    if (/^https?:\/\//.test(url)) {
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const owner = await requirePermission("measurements:manage");
  const { userId } = await params;

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: owner.tenantId, role: "TENANT_MEMBER" },
    select: { name: true, email: true },
  });
  if (!member) return new NextResponse("Niet gevonden", { status: 404 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { name: true, accentColor: true, logoUrl: true },
  });

  const [rows, deltas, goals, series] = await Promise.all([
    listMeasurements(owner.tenantId, userId),
    getDeltas(owner.tenantId, userId),
    getGoals(owner.tenantId, userId),
    getSeries(owner.tenantId, userId, "all"),
  ]);
  const latest = rows[0] ?? null;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = hexColor(tenant?.accentColor);
  const BLACK = rgb(0.12, 0.12, 0.12);
  const GRAY = rgb(0.45, 0.45, 0.45);
  const LINE = rgb(0.85, 0.85, 0.85);

  let page = doc.addPage([595, 842]); // A4
  const M = 48;
  let y = 0;

  const text = (s: string, x: number, yy: number, size: number, f: PDFFont, color = BLACK) =>
    page.drawText(s, { x, y: yy, size, font: f, color });

  function ensure(space: number) {
    if (y - space < M) {
      page = doc.addPage([595, 842]);
      y = 842 - M;
    }
  }
  function heading(label: string) {
    ensure(40);
    y -= 8;
    text(label, M, y, 12, bold, accent);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: 595 - M, y }, thickness: 0.7, color: LINE });
    y -= 16;
  }

  // --- Branded header ---
  page.drawRectangle({ x: 0, y: 842 - 96, width: 595, height: 96, color: accent });
  text(tenant?.name ?? "GymRebel", M, 842 - 44, 18, bold, rgb(1, 1, 1));
  text("Voortgangsrapport", M, 842 - 66, 11, font, rgb(1, 1, 1));
  if (tenant?.logoUrl) {
    const bytes = await fetchImageBytes(tenant.logoUrl);
    if (bytes) {
      try {
        const img = tenant.logoUrl.includes(".png") || tenant.logoUrl.startsWith("data:image/png")
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        const w = 44;
        const h = (img.height / img.width) * w;
        page.drawImage(img, { x: 595 - M - w, y: 842 - 48 - h / 2, width: w, height: h });
      } catch {
        /* logo overslaan */
      }
    }
  }
  y = 842 - 96 - 28;

  text(member.name ?? member.email, M, y, 16, bold);
  y -= 16;
  text(
    `Gegenereerd op ${new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}` +
      (latest ? ` · laatste meting ${new Date(latest.measuredAt).toLocaleDateString("nl-NL")}` : ""),
    M,
    y,
    9,
    font,
    GRAY
  );
  y -= 22;

  if (!latest) {
    text("Er zijn nog geen metingen vastgelegd voor dit lid.", M, y, 11, font, GRAY);
  } else {
    // --- Laatste meetwaarden ---
    heading("Laatste meetwaarden");
    const filled = [...COMPOSITION_METRICS, ...CIRCUMFERENCE_METRICS].filter(
      (m) => latest.values[m.key] != null
    );
    const colW = (595 - 2 * M) / 2;
    for (let i = 0; i < filled.length; i += 2) {
      ensure(18);
      for (let c = 0; c < 2; c++) {
        const def = filled[i + c];
        if (!def) continue;
        const x = M + c * colW;
        text(def.label, x, y, 9.5, font, GRAY);
        text(formatMetric(def.key, latest.values[def.key]), x + colW - 90, y, 10, bold);
      }
      y -= 16;
    }

    // --- Ontwikkeling ---
    const withDelta = deltas.filter((d) => d.delta != null && d.delta !== 0);
    if (withDelta.length > 0) {
      heading("Ontwikkeling (t.o.v. vorige meting)");
      for (const d of withDelta) {
        ensure(16);
        const arrow = (d.delta ?? 0) > 0 ? "+" : "";
        const color = d.tone === "good" ? rgb(0.1, 0.5, 0.2) : d.tone === "bad" ? rgb(0.7, 0.1, 0.1) : BLACK;
        text(d.label, M, y, 10, font, GRAY);
        text(`${arrow}${formatMetric(d.key, d.delta)}`, M + 200, y, 10, bold, color);
        y -= 15;
      }
    }

    // --- Gewichtstrend (handgetekend) ---
    const wPoints = series.map((p) => p.weightKg).filter((v): v is number => v != null);
    if (wPoints.length >= 2) {
      heading("Gewichtstrend");
      ensure(110);
      const gx = M;
      const gy = y - 96;
      const gw = 595 - 2 * M;
      const gh = 90;
      page.drawRectangle({ x: gx, y: gy, width: gw, height: gh, borderColor: LINE, borderWidth: 0.7 });
      const min = Math.min(...wPoints);
      const max = Math.max(...wPoints);
      const span = max - min || 1;
      const stepX = gw / (wPoints.length - 1);
      for (let i = 1; i < wPoints.length; i++) {
        page.drawLine({
          start: { x: gx + (i - 1) * stepX, y: gy + 8 + ((wPoints[i - 1] - min) / span) * (gh - 16) },
          end: { x: gx + i * stepX, y: gy + 8 + ((wPoints[i] - min) / span) * (gh - 16) },
          thickness: 1.5,
          color: accent,
        });
      }
      text(`${max.toFixed(1)} kg`, gx + 4, gy + gh - 12, 8, font, GRAY);
      text(`${min.toFixed(1)} kg`, gx + 4, gy + 4, 8, font, GRAY);
      y = gy - 16;
    }

    // --- Doelen ---
    if (goals.length > 0) {
      heading("Doelen");
      for (const g of goals) {
        ensure(16);
        const pct = g.percent != null ? ` (${g.percent}%${g.achieved ? " — behaald" : ""})` : "";
        text(GOAL_METRIC_LABEL[g.metric], M, y, 10, font, GRAY);
        text(
          `${formatMetric(g.metricKey, g.current)} → ${formatMetric(g.metricKey, g.targetValue)}${pct}`,
          M + 200,
          y,
          10,
          bold
        );
        y -= 15;
      }
    }

    // --- Opmerkingen ---
    if (latest.notes) {
      heading("Opmerkingen trainer");
      for (const line of latest.notes.match(/.{1,90}/g) ?? []) {
        ensure(14);
        text(line, M, y, 10, font);
        y -= 13;
      }
    }

    // --- Foto's (laatste meting) ---
    if (latest.photos.length > 0) {
      heading("Voortgangsfoto's");
      ensure(160);
      let px = M;
      for (const photo of latest.photos.slice(0, 3)) {
        const bytes = await fetchImageBytes(photo.url);
        if (!bytes) continue;
        try {
          const img =
            photo.url.includes(".png") || photo.url.startsWith("data:image/png")
              ? await doc.embedPng(bytes)
              : await doc.embedJpg(bytes);
          const w = 150;
          const h = Math.min(180, (img.height / img.width) * w);
          page.drawImage(img, { x: px, y: y - h, width: w, height: h });
          px += w + 12;
        } catch {
          /* foto overslaan */
        }
      }
      y -= 190;
    }
  }

  const pdfBytes = await doc.save();

  await audit("measurement.report.export", {
    actor: owner,
    tenantId: owner.tenantId,
    targetType: "User",
    targetId: userId,
    metadata: { member: member.name ?? member.email },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = (member.name ?? member.email).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(pdfBytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="voortgang-${safeName}-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
