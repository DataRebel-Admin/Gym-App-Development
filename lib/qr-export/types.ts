// Pure, gedeelde types + presets voor de QR-bulkexport. Géén server-only import,
// zodat zowel de client (dialog/voorvertoning) als de server (PDF/ZIP) dit deelt.
// Idioom: lib/exercise-types.ts / lib/maintenance.ts (pure kern, ook client).

export type QrExportFormat = "pdf" | "zip-png" | "zip-svg";

/** Eén te exporteren apparaat, volledig geserialiseerd (client-safe). */
export type QrExportMachine = {
  id: string;
  /** Apparaatnaam (bv. "Loopband"). */
  name: string;
  /** Stabiel volgnummer binnen de tenant (1-based), voor label + bestandsnaam. */
  number: number;
  /** Serie-/inventarisnummer, indien bekend. */
  serialNumber: string | null;
  /** Locatie binnen de sportschool (vrij tekstveld). */
  location: string | null;
  /** Categorie/type-label (bv. "Cardio"). */
  category: string;
  /** Publieke QR-doel-URL (tenant-scoped). */
  url: string;
};

/** Tenant-branding voor de export (naam + logo + accentkleur). */
export type QrExportBranding = {
  tenantName: string;
  logoUrl: string | null;
  accentColor: string | null;
};

/** Een tenant-groep (superadmin "alle tenants" → één sectie per tenant). */
export type QrExportGroup = {
  branding: QrExportBranding;
  machines: QrExportMachine[];
};

/** Door de gebruiker gekozen export-opties. */
export type QrExportOptions = {
  format: QrExportFormat;
  /** Aantal kolommen in het A4-raster (2 = groter, 3 = compacter). */
  columns: 2 | 3;
  /** Snij-/hoeklijnen tekenen zodat labels netjes uit te knippen zijn. */
  cutMarks: boolean;
  includeLogo: boolean;
  includeSerial: boolean;
  includeCategory: boolean;
};

export const DEFAULT_QR_EXPORT_OPTIONS: QrExportOptions = {
  format: "pdf",
  columns: 2,
  cutMarks: true,
  includeLogo: true,
  includeSerial: true,
  includeCategory: true,
};

/**
 * Rasterindeling per kolom-aantal. `perPage` wordt gedeeld door de PDF-builder
 * (echte layout) én de UI-voorvertoning (pagina-schatting) zodat ze nooit
 * uiteenlopen. `rows` × `columns` = `perPage`.
 */
export const LAYOUT_PRESETS: Record<2 | 3, { columns: 2 | 3; rows: number; perPage: number }> = {
  2: { columns: 2, rows: 4, perPage: 8 },
  3: { columns: 3, rows: 5, perPage: 15 },
};

/** Verwacht aantal A4-pagina's voor `count` labels bij `columns` kolommen. */
export function expectedPageCount(count: number, columns: 2 | 3): number {
  if (count <= 0) return 0;
  return Math.ceil(count / LAYOUT_PRESETS[columns].perPage);
}

/** Filter-parameters voor de server (queryen van te exporteren machines). */
export type QrExportFilter = {
  type?: string;
  location?: string;
  status?: string;
  /** Expliciete selectie; overschrijft de overige filters wanneer gezet. */
  ids?: string[];
};

export const QR_EXPORT_FORMATS: readonly QrExportFormat[] = ["pdf", "zip-png", "zip-svg"];

export function isQrExportFormat(v: string): v is QrExportFormat {
  return (QR_EXPORT_FORMATS as readonly string[]).includes(v);
}
