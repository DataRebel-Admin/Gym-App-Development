import "server-only";
import type { AppReport } from "@prisma/client";
import { formatReportRef } from "@/lib/report-context";

// GitHub-issue aanmaken vanuit een app-melding. Greenfield externe koppeling,
// gemodelleerd op lib/email/graph.ts (configured()-guard + fetch + res.ok).
// Bewust GEEN melder-PII in de issue-body — alleen rol/herkomst/context.

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}

export type GithubIssueResult =
  | { url: string; number: number }
  | { error: string };

function issueBody(report: AppReport): string {
  const origin =
    report.reporterRole === "TENANT_MEMBER" || report.reporterRole === null
      ? "lid"
      : "sportschool";
  const row = (label: string, value: string | null) =>
    value ? `| ${label} | ${value.replace(/\|/g, "\\|")} |` : null;

  const context = [
    "| Veld | Waarde |",
    "| --- | --- |",
    row("Referentie", formatReportRef(report.id)),
    row("Type", report.type),
    row("Severity", report.severity),
    row("Herkomst", `${origin} (${report.reporterRole ?? "niet ingelogd"})`),
    row("Route", report.route),
    row("App-versie", report.appVersion),
    row("Build", report.buildId),
    row("Platform", report.platform),
    row("OS", report.osVersion),
    row("Schermformaat", report.screenSize),
    row("Taal", report.locale),
    row("Gemeld op", report.createdAt.toISOString()),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const errors = Array.isArray(report.clientErrors)
    ? report.clientErrors
        .map((e) =>
          typeof e === "object" && e !== null && "message" in e
            ? `- ${String((e as { message: unknown }).message)}`
            : null
        )
        .filter(Boolean)
        .join("\n")
    : "";

  return [
    report.description,
    "",
    "### Context",
    context,
    errors ? "\n### Laatste client-errors\n" + errors : "",
    "",
    `_Automatisch aangemaakt vanuit de GymRebel meldingen-inbox (${formatReportRef(report.id)})._`,
  ].join("\n");
}

/** Maakt een GitHub-issue aan voor de melding en geeft de issue-URL terug. */
export async function createGithubIssue(report: AppReport): Promise<GithubIssueResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/repo"
  if (!token || !repo) return { error: "niet geconfigureerd" };

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: `[${report.type}] ${report.title}`,
        body: issueBody(report),
        labels: ["from-app", report.type.toLowerCase(), report.severity.toLowerCase()],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[reports] GitHub-issue aanmaken gaf ${res.status}: ${detail.slice(0, 300)}`);
      return { error: `GitHub gaf status ${res.status}` };
    }
    const issue = (await res.json()) as { html_url: string; number: number };
    return { url: issue.html_url, number: issue.number };
  } catch (err) {
    console.error("[reports] GitHub-issue aanmaken mislukt:", err);
    return { error: "netwerkfout" };
  }
}
