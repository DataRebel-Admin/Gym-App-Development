import type { BadgeTone } from "@/components/ui/badge";
import type { ReportType, ReportStatus, ReportSeverity } from "@prisma/client";
import type { ReportOrigin } from "@/lib/report-query";

// Labels + badge-tonen voor de meldingen-inbox (admin-UI, hardcoded NL —
// precedent muscles/engagement/maintenance). Eén bron van waarheid voor
// filterbalk, tabel en detailpaneel.

export const REPORT_TYPE_META: Record<ReportType, { label: string; tone: BadgeTone }> = {
  BUG: { label: "Bug", tone: "danger" },
  FEEDBACK: { label: "Feedback", tone: "accent" },
  QUESTION: { label: "Vraag", tone: "neutral" },
};

export const REPORT_STATUS_META: Record<ReportStatus, { label: string; tone: BadgeTone }> = {
  NEW: { label: "Nieuw", tone: "warning" },
  TRIAGED: { label: "Getrieerd", tone: "accent" },
  IN_PROGRESS: { label: "In behandeling", tone: "accent" },
  RESOLVED: { label: "Opgelost", tone: "success" },
  WONTFIX: { label: "Wordt niet opgelost", tone: "neutral" },
  DUPLICATE: { label: "Duplicaat", tone: "neutral" },
};

export const REPORT_SEVERITY_META: Record<ReportSeverity, { label: string; tone: BadgeTone }> = {
  LOW: { label: "Laag", tone: "neutral" },
  NORMAL: { label: "Normaal", tone: "neutral" },
  HIGH: { label: "Hoog", tone: "warning" },
  BLOCKER: { label: "Blocker", tone: "danger" },
};

export const REPORT_ORIGIN_META: Record<ReportOrigin, { label: string; tone: BadgeTone }> = {
  lid: { label: "Lid", tone: "accent" },
  sportschool: { label: "Sportschool", tone: "neutral" },
};

/** Leesbaar rollabel voor het detailpaneel. */
export const REPORTER_ROLE_LABEL: Record<string, string> = {
  TENANT_MEMBER: "Lid",
  TENANT_STAFF: "Medewerker",
  TENANT_ADMIN: "Eigenaar",
  SUPERADMIN: "Superadmin",
};
