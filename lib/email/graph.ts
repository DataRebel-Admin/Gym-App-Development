import "server-only";

/**
 * Microsoft Graph e-mailverzending via de client-credentials-flow (app-only).
 * Bewust met `fetch` (geen extra SDK-deps). Vereist een app-registratie met
 * **application**-permissie `Mail.Send` (admin consent) en een afzender-mailbox.
 *
 * Env:
 *   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER (mailbox UPN)
 */

type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sender: string;
};

export function graphConfig(): GraphConfig | null {
  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  const sender = process.env.GRAPH_SENDER;
  if (!tenantId || !clientId || !clientSecret || !sender) return null;
  return { tenantId, clientId, clientSecret, sender };
}

export function graphConfigured(): boolean {
  return graphConfig() !== null;
}

// Eenvoudige in-memory token-cache (app-only token, ~60 min geldig).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(cfg: GraphConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const url = `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Graph-token ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

/** Verstuur een HTML-e-mail via Graph. Gooit bij fout (de caller logt/faalt netjes). */
export async function sendMailViaGraph(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const cfg = graphConfig();
  if (!cfg) throw new Error("Graph niet geconfigureerd");

  const token = await getAccessToken(cfg);
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.sender)}/sendMail`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: opts.subject,
        body: { contentType: "HTML", content: opts.html },
        toRecipients: [{ emailAddress: { address: opts.to } }],
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Graph sendMail ${res.status}: ${await res.text()}`);
  }
}
