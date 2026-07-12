import { NextResponse } from "next/server";

/**
 * Digital Asset Links — koppelt deze website aan de Android TWA-app (Play).
 * Google's TWA verifieert `https://<host>/.well-known/assetlinks.json`; matcht de
 * app-handtekening, dan verdwijnt de URL-balk en mag de app web-push tonen.
 *
 * Waarden komen uit env (bestaan pas ná de eerste build / Play App Signing):
 *   ANDROID_PACKAGE_NAME       bv. app.gymrebel.twa
 *   ANDROID_CERT_FINGERPRINTS  komma-gescheiden SHA-256 fingerprints
 *                              (meestal 2: je upload-key én de Play App Signing-key)
 *
 * Zonder config → lege lijst (geldig JSON, nog niet gekoppeld). force-dynamic
 * zodat env-wijzigingen zonder herbuild direct doorwerken.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (process.env.ANDROID_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const statements =
    packageName && fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: packageName,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [];

  return NextResponse.json(statements, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
