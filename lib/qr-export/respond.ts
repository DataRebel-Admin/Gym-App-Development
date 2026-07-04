import "server-only";
import { buildQrLabelsPdf } from "./labels-pdf";
import { buildQrZip } from "./archive";
import { safeFilename } from "./filename";
import type { QrExportGroup, QrExportOptions } from "./types";

// Bouwt de daadwerkelijke download (bytes + headers) uit groepen + opties.
// Gedeeld door de owner- én admin-route zodat het gedrag identiek is.

export type QrExportResult = {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
};

export async function buildQrExport(
  groups: QrExportGroup[],
  options: QrExportOptions,
  baseName: string,
): Promise<QrExportResult> {
  const base = safeFilename(baseName) || "qr-codes";
  if (options.format === "pdf") {
    const bytes = await buildQrLabelsPdf(groups, options);
    return { bytes, contentType: "application/pdf", filename: `${base}.pdf` };
  }
  const kind = options.format === "zip-svg" ? "svg" : "png";
  const bytes = await buildQrZip(groups, kind, options);
  return { bytes, contentType: "application/zip", filename: `${base}-${kind}.zip` };
}

/** Parset de gedeelde query-parameters naar `QrExportOptions`. */
export function parseExportOptions(searchParams: URLSearchParams): QrExportOptions {
  const format = searchParams.get("format");
  const columns = searchParams.get("columns") === "3" ? 3 : 2;
  const bool = (key: string, dflt: boolean) => {
    const v = searchParams.get(key);
    if (v == null) return dflt;
    return v === "1" || v === "true";
  };
  return {
    format: format === "zip-png" || format === "zip-svg" ? format : "pdf",
    columns,
    cutMarks: bool("cutMarks", true),
    includeLogo: bool("logo", true),
    includeSerial: bool("serial", true),
    includeCategory: bool("category", true),
  };
}
