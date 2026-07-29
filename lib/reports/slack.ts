import "server-only";

// Slack-webhook voor urgente app-meldingen (BLOCKER / piek) en de digest.
// Stijl lib/email/graph.ts: configured()-guard, kale fetch, res.ok-check,
// nooit throwen — een falende notificatie mag de actie niet breken.

export function slackConfigured(): boolean {
  return Boolean(process.env.REPORTS_SLACK_WEBHOOK_URL);
}

/** Verstuurt een bericht naar de team-webhook. `true` = daadwerkelijk verzonden. */
export async function sendSlackMessage(text: string): Promise<boolean> {
  const url = process.env.REPORTS_SLACK_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[reports] Slack-webhook gaf ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[reports] Slack-webhook mislukt:", err);
    return false;
  }
}
