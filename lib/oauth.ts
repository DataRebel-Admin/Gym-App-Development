// Welke OAuth-/SSO-providers zijn geconfigureerd (server-side, env-gebaseerd).
// Alleen in Server Components gebruiken (leest niet-publieke env-vars).

export type OAuthStatus = { google: boolean; microsoft: boolean };

export function oauthEnabled(): OAuthStatus {
  return {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    microsoft: Boolean(
      process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
    ),
  };
}
