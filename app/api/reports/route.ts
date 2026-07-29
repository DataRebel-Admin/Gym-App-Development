import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { uploadReportScreenshot } from "@/lib/blob";
import { sanitizeReportContext, formatReportRef } from "@/lib/report-context";
import { notifyDevTeamImmediate } from "@/lib/reports/notify";

// Probleem melden aan de developers. Bewust een route-handler (geen server
// action): crashschermen (app/global-error.tsx, zonder providers) moeten ook
// kunnen melden, en de submit draagt client-context + optioneel een bestand.
// De context wordt server-side ALTIJD opnieuw gesaneerd via de whitelist
// (lib/report-context.ts) — de client wordt nooit vertrouwd.
export const dynamic = "force-dynamic";

/** Daglimiet voor ingelogde melders. */
const DAILY_LIMIT_USER = 10;
/** Daglimiet per (gehasht) IP voor niet-ingelogde melders. */
const DAILY_LIMIT_ANON = 5;

const reportSchema = z.object({
  type: z.enum(["BUG", "FEEDBACK", "QUESTION"]),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(5000),
  contactAllowed: z.boolean(),
  anonymous: z.boolean(),
  crash: z.boolean(),
});

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * HMAC van het client-IP voor de anonieme rate-limit. Het ruwe IP wordt
 * nergens opgeslagen; zonder AUTH_SECRET of IP géén hash (dan geldt alleen
 * de ingelogde limiet).
 */
function hashIp(req: Request): string | null {
  const secret = process.env.AUTH_SECRET;
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim();
  if (!secret || !ip) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const user = session?.user ?? null;

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const parsed = reportSchema.safeParse({
      type: String(form.get("type") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      contactAllowed: form.get("contactAllowed") === "1",
      anonymous: form.get("anonymous") === "1",
      crash: form.get("crash") === "1",
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const input = parsed.data;

    // --- Rate limit (patroon AiUsage: append-only tellen per kalenderdag). ---
    const since = startOfToday();
    const ipHash = user ? null : hashIp(req);
    if (user) {
      const usedToday = await prisma.reportQuota.count({
        where: { userId: user.id, createdAt: { gte: since } },
      });
      if (usedToday >= DAILY_LIMIT_USER) {
        return NextResponse.json({ error: "rate-limited" }, { status: 429 });
      }
    } else if (ipHash) {
      const usedToday = await prisma.reportQuota.count({
        where: { ipHash, createdAt: { gte: since } },
      });
      if (usedToday >= DAILY_LIMIT_ANON) {
        return NextResponse.json({ error: "rate-limited" }, { status: 429 });
      }
    }

    // --- Context: defensief parsen + whitelist-sanering (faalt nooit). ---
    let context: ReturnType<typeof sanitizeReportContext> = {};
    const rawContext = form.get("context");
    if (typeof rawContext === "string" && rawContext) {
      try {
        context = sanitizeReportContext(JSON.parse(rawContext));
      } catch {
        context = {};
      }
    }

    // --- Screenshot (opt-in; melding gaat door ook als de upload niet kan). ---
    let screenshotKey: string | null = null;
    let screenshotIssue: string | null = null;
    const screenshot = form.get("screenshot");
    if (screenshot instanceof File && screenshot.size > 0) {
      const uploaded = await uploadReportScreenshot(screenshot);
      if ("url" in uploaded) screenshotKey = uploaded.url;
      else screenshotIssue = uploaded.error;
    }

    // Anoniem = géén gebruikers-ID in de melding (criterium 5). Contact kan
    // dan uiteraard ook niet.
    const anonymous = input.anonymous || !user;
    const report = await prisma.appReport.create({
      data: {
        type: input.type,
        severity: input.crash ? "HIGH" : "NORMAL",
        reportedById: anonymous || !user ? null : user.id,
        reporterRole: user?.role ?? null,
        tenantId: user?.tenantId ?? null,
        contactAllowed: anonymous ? false : input.contactAllowed,
        title: input.title,
        description: input.description,
        screenshotKey,
        route: context.route ?? null,
        appVersion: context.appVersion ?? null,
        buildId: context.buildId ?? null,
        platform: context.platform ?? null,
        osVersion: context.osVersion ?? null,
        device: context.device ?? null,
        screenSize: context.screenSize ?? null,
        userAgent: context.userAgent ?? null,
        locale: context.locale ?? null,
        clientErrors: context.clientErrors ?? undefined,
      },
    });

    // Quota-rij los van de inhoud: bij anoniem mét userId (er is geen link
    // naar wélke melding), zodat de daglimiet ook anoniem geldt.
    await prisma.reportQuota.create({
      data: { userId: user?.id ?? null, ipHash },
    });

    await audit("report.create", {
      actor:
        anonymous || !user
          ? { id: null, email: null, role: user?.role ?? null }
          : { id: user.id, email: user.email, role: user.role },
      tenantId: user?.tenantId ?? null,
      targetType: "AppReport",
      targetId: report.id,
      metadata: {
        type: input.type,
        severity: report.severity,
        anonymous,
        route: context.route ?? null,
      },
    });

    // Piek-detectie: ≥3 meldingen binnen een uur op dezelfde route → direct
    // signaal naar het team (best-effort, blokkeert de response niet inhoudelijk).
    if (context.route) {
      try {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentOnRoute = await prisma.appReport.count({
          where: { route: context.route, createdAt: { gte: hourAgo } },
        });
        if (recentOnRoute >= 3) {
          await notifyDevTeamImmediate(report, "burst");
        }
      } catch (err) {
        console.error("[reports] piek-detectie mislukt:", err);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        id: report.id,
        ref: formatReportRef(report.id),
        ...(screenshotIssue ? { screenshot: screenshotIssue } : {}),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[reports] melding opslaan mislukt:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
