"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/superadmin";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

// Server-actions voor de meldingen-inbox (/admin/meldingen). Patroon
// app/admin/tenants/actions.ts: requireSuperadmin() eerst → zod → mutatie →
// audit (met old/newValue) → revalidatePath.

export type ReportActionState = { ok?: boolean; error?: string };

const STATUS_VALUES = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "RESOLVED",
  "WONTFIX",
  "DUPLICATE",
] as const;
const SEVERITY_VALUES = ["LOW", "NORMAL", "HIGH", "BLOCKER"] as const;

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUS_VALUES),
});

export async function updateReportStatus(
  _prev: ReportActionState,
  formData: FormData
): Promise<ReportActionState> {
  const admin = await requireSuperadmin();
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Ongeldige invoer" };
  const { id, status } = parsed.data;

  const report = await prisma.appReport.findUnique({ where: { id } });
  if (!report) return { error: "Melding niet gevonden" };
  if (report.status === status) return { ok: true };

  const resolved = status === "RESOLVED";
  await prisma.appReport.update({
    where: { id },
    data: {
      status,
      resolvedAt: resolved ? new Date() : report.resolvedAt,
      resolvedById: resolved ? admin.id : report.resolvedById,
    },
  });

  await audit("report.status.change", {
    actor: admin,
    tenantId: report.tenantId,
    targetType: "AppReport",
    targetId: id,
    oldValue: { status: report.status },
    newValue: { status },
    metadata: { status },
  });

  // Melder informeren bij afronding — alleen mét toestemming (stap 6 vult de
  // daadwerkelijke kanalen in via notifyReporterResolved).
  if (resolved && report.contactAllowed && report.reportedById) {
    const { notifyReporterResolved } = await import("@/lib/reports/notify");
    await notifyReporterResolved(report).catch(() => {});
  }

  revalidatePath("/admin/meldingen");
  return { ok: true };
}

const severitySchema = z.object({
  id: z.string().min(1),
  severity: z.enum(SEVERITY_VALUES),
});

export async function updateReportSeverity(
  _prev: ReportActionState,
  formData: FormData
): Promise<ReportActionState> {
  const admin = await requireSuperadmin();
  const parsed = severitySchema.safeParse({
    id: formData.get("id"),
    severity: formData.get("severity"),
  });
  if (!parsed.success) return { error: "Ongeldige invoer" };
  const { id, severity } = parsed.data;

  const report = await prisma.appReport.findUnique({ where: { id } });
  if (!report) return { error: "Melding niet gevonden" };
  if (report.severity === severity) return { ok: true };

  await prisma.appReport.update({ where: { id }, data: { severity } });

  await audit("report.severity.change", {
    actor: admin,
    tenantId: report.tenantId,
    targetType: "AppReport",
    targetId: id,
    oldValue: { severity: report.severity },
    newValue: { severity },
    metadata: { severity },
  });

  // Opschaling naar BLOCKER → direct signaal naar het team (best-effort).
  if (severity === "BLOCKER") {
    const { notifyDevTeamImmediate } = await import("@/lib/reports/notify");
    await notifyDevTeamImmediate({ ...report, severity }, "blocker").catch(() => {});
  }

  revalidatePath("/admin/meldingen");
  return { ok: true };
}

const duplicateSchema = z.object({
  id: z.string().min(1),
  duplicateOfId: z.string().min(1),
});

export async function linkReportDuplicate(
  _prev: ReportActionState,
  formData: FormData
): Promise<ReportActionState> {
  const admin = await requireSuperadmin();
  const parsed = duplicateSchema.safeParse({
    id: formData.get("id"),
    duplicateOfId: String(formData.get("duplicateOfId") ?? "").trim(),
  });
  if (!parsed.success) return { error: "Ongeldige invoer" };
  const { id, duplicateOfId } = parsed.data;
  if (id === duplicateOfId) return { error: "Een melding kan geen duplicaat van zichzelf zijn" };

  const [report, original] = await Promise.all([
    prisma.appReport.findUnique({ where: { id } }),
    prisma.appReport.findUnique({ where: { id: duplicateOfId } }),
  ]);
  if (!report) return { error: "Melding niet gevonden" };
  if (!original) return { error: "Origineel niet gevonden, controleer het ID" };

  await prisma.appReport.update({
    where: { id },
    data: { duplicateOfId, status: "DUPLICATE" },
  });

  await audit("report.duplicate.link", {
    actor: admin,
    tenantId: report.tenantId,
    targetType: "AppReport",
    targetId: id,
    metadata: { duplicateOfId },
  });

  revalidatePath("/admin/meldingen");
  return { ok: true };
}

const noteSchema = z.object({
  id: z.string().min(1),
  note: z.string().max(5000),
});

export async function saveReportNote(
  _prev: ReportActionState,
  formData: FormData
): Promise<ReportActionState> {
  const admin = await requireSuperadmin();
  const parsed = noteSchema.safeParse({
    id: formData.get("id"),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: "Ongeldige invoer" };
  const { id, note } = parsed.data;

  const report = await prisma.appReport.findUnique({ where: { id } });
  if (!report) return { error: "Melding niet gevonden" };

  await prisma.appReport.update({
    where: { id },
    data: { internalNote: note.trim() || null },
  });

  await audit("report.note.update", {
    actor: admin,
    tenantId: report.tenantId,
    targetType: "AppReport",
    targetId: id,
  });

  revalidatePath("/admin/meldingen");
  return { ok: true };
}

export async function createReportGithubIssue(
  _prev: ReportActionState,
  formData: FormData
): Promise<ReportActionState> {
  const admin = await requireSuperadmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ongeldige invoer" };

  const report = await prisma.appReport.findUnique({ where: { id } });
  if (!report) return { error: "Melding niet gevonden" };
  if (report.externalRef) return { error: "Er is al een issue gekoppeld" };

  const { createGithubIssue, githubConfigured } = await import("@/lib/reports/github");
  if (!githubConfigured()) {
    return { error: "GitHub is niet geconfigureerd (GITHUB_TOKEN + GITHUB_REPO)" };
  }
  const result = await createGithubIssue(report);
  if ("error" in result) return { error: `GitHub-issue aanmaken mislukt: ${result.error}` };

  await prisma.appReport.update({
    where: { id },
    data: { externalRef: result.url },
  });

  await audit("report.github.create", {
    actor: admin,
    tenantId: report.tenantId,
    targetType: "AppReport",
    targetId: id,
    metadata: { issue: `#${result.number}`, url: result.url },
  });

  revalidatePath("/admin/meldingen");
  return { ok: true };
}
