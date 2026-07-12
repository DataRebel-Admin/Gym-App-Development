import { NextResponse } from "next/server";

/**
 * Apple App Site Association (AASA) — de iOS-tegenhanger van assetlinks.json.
 * Apple haalt `https://<host>/.well-known/apple-app-site-association` op (zonder
 * .json-extensie, content-type application/json) om de app te koppelen aan het
 * domein voor:
 *  - **webcredentials** → native passkeys (Associated Domains) werken in de app;
 *  - **applinks** → universal links (o.a. magic-link opent de app i.p.v. Safari).
 *
 * `APPLE_APP_ID` = "<TeamID>.<bundleId>" (bv. "ABCDE12345.app.gymrebel.mobile").
 * Zonder env → lege koppelingen (geldig JSON, nog niet gekoppeld). force-dynamic
 * zodat env-wijzigingen zonder herbuild doorwerken.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const appId = process.env.APPLE_APP_ID?.trim();
  const apps = appId ? [appId] : [];

  const body = {
    applinks: {
      details: appId ? [{ appIDs: apps, components: [{ "/": "*" }] }] : [],
    },
    webcredentials: { apps },
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
