import "server-only";
import { buildZip, type ZipEntry } from "./zip";
import { loadLogoDataUri, qrPngBytes, qrSvgBytes, type QrRenderStyle } from "./qr";
import { dedupeFilenames, numberedFilename, safeFilename } from "./filename";
import type { QrExportGroup, QrExportOptions } from "./types";

// Bouwt een ZIP met losse QR-bestanden (PNG of SVG), gestyled per tenant (accent +
// midden-logo). Bij meerdere tenant-groepen komt elke tenant in een eigen submap.

type Kind = "png" | "svg";

export async function buildQrZip(
  groups: QrExportGroup[],
  kind: Kind,
  options: QrExportOptions,
): Promise<Uint8Array> {
  const multi = groups.filter((g) => g.machines.length > 0).length > 1;
  const entries: ZipEntry[] = [];

  for (const group of groups) {
    if (group.machines.length === 0) continue;
    const folder = multi ? `${safeFilename(group.branding.tenantName)}/` : "";

    // Style één keer per groep bepalen (logo-fetch is duur → niet per machine).
    const style: QrRenderStyle = {
      accent: group.branding.accentColor,
      logoDataUri: options.includeLogo
        ? await loadLogoDataUri(group.branding.logoUrl)
        : null,
    };

    // Bestandsnamen eerst genereren + dedupliceren binnen de (sub)map.
    const rawNames = group.machines.map((m) => numberedFilename(m.name, m.number, kind));
    const names = dedupeFilenames(rawNames);

    for (let i = 0; i < group.machines.length; i++) {
      const m = group.machines[i];
      const data = kind === "png" ? qrPngBytes(m.url, style) : qrSvgBytes(m.url, style);
      entries.push({ name: `${folder}${names[i]}`, data });
    }
  }

  return buildZip(entries);
}
