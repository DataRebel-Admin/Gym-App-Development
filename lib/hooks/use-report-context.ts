"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useClientValue } from "@/lib/hooks/use-client-value";
import { getClientErrors } from "@/lib/report-client-errors";
import { CHANGELOG } from "@/lib/changelog";
import type { ClientErrorEntry, ReportContext } from "@/lib/report-context";

// Verzamelt de automatisch mee te sturen context voor een probleem-melding.
// Alles SSR-safe (server-fallback → echte clientwaarde na hydratie) en
// uitsluitend whitelist-velden — de server saneert daarbovenop nogmaals met
// `sanitizeReportContext` (nooit de client vertrouwen).

const EMPTY_ERRORS: ClientErrorEntry[] = [];

/** Lichte OS-detectie uit de user-agent — best-effort, alleen voor triage. */
function osFromUserAgent(ua: string): string | undefined {
  const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/Windows NT ([\d.]+)/, (m) => `Windows ${m[1]}`],
    [/Android ([\d.]+)/, (m) => `Android ${m[1]}`],
    [/(?:iPhone|iPad).*OS (\d+[_\d]*)/, (m) => `iOS ${m[1].replace(/_/g, ".")}`],
    [/Mac OS X (\d+[_\d.]*)/, (m) => `macOS ${m[1].replace(/_/g, ".")}`],
    [/Linux/, () => "Linux"],
  ];
  for (const [pattern, format] of patterns) {
    const match = ua.match(pattern);
    if (match) return format(match);
  }
  return undefined;
}

/**
 * Hook die de actuele `ReportContext` teruggeeft: route, app-versie/build,
 * platform (web/ios/android), OS, schermformaat, taal, user-agent en de
 * laatste client-errors uit de ringbuffer. De gebruiker hoeft niets in te
 * vullen; het formulier toont dit object vóór verzenden ("Dit sturen we mee").
 */
export function useReportContext(): ReportContext {
  const pathname = usePathname();

  const userAgent = useClientValue(() => navigator.userAgent, "");
  const screenSize = useClientValue(
    () => `${window.screen.width}x${window.screen.height}`,
    ""
  );
  const locale = useClientValue(
    () => document.documentElement.lang || navigator.language,
    ""
  );
  const platform = useClientValue(
    () => (Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web"),
    "web"
  );
  const clientErrors = useClientValue(getClientErrors, EMPTY_ERRORS);

  return useMemo<ReportContext>(() => {
    const context: ReportContext = {
      route: pathname ?? undefined,
      appVersion: CHANGELOG[0]?.version,
      buildId: process.env.NEXT_PUBLIC_BUILD_ID,
      platform,
    };
    if (userAgent) {
      context.userAgent = userAgent;
      const os = osFromUserAgent(userAgent);
      if (os) context.osVersion = os;
    }
    if (screenSize) context.screenSize = screenSize;
    if (locale) context.locale = locale;
    if (clientErrors.length > 0) context.clientErrors = clientErrors;
    return context;
  }, [pathname, platform, userAgent, screenSize, locale, clientErrors]);
}
