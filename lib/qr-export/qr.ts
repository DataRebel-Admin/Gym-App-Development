import "server-only";
import { Resvg } from "@resvg/resvg-js";
import { qrMatrix } from "./qr-matrix";
import { renderStyledQrSvg, type QrStyleOptions } from "./qr-style";

// Server-side QR-rendering voor de export. Gestyled (accent + afgeronde modules +
// midden-logo) via de gedeelde, pure renderer in ./qr-style. Foutcorrectie "H"
// (in ./qr-matrix) dekt het logo-overlay ruim.

// Re-export zodat bestaande imports (`{ qrMatrix, type QrModules }` uit "./qr")
// blijven werken; ./qr-matrix is de pure bron.
export { qrMatrix } from "./qr-matrix";
export type { QrModules } from "./qr-matrix";

/** Style-opties zonder de matrix zelf (die leiden we uit de URL af). */
export type QrRenderStyle = Omit<QrStyleOptions, "pixelSize">;

/**
 * Haalt een remote logo op en levert het als data-URI (self-contained → werkt in
 * het SVG-bestand én in resvg, dat geen remote URL's ophaalt). Degradeert netjes
 * naar `null`. Model naar `embedLogo` in ./labels-pdf.
 */
export async function loadLogoDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const lower = url.toLowerCase();
    const mime = ct.startsWith("image/")
      ? ct
      : lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".svg")
          ? "image/svg+xml"
          : "image/jpeg";
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

/** Gestylde vector-SVG (self-contained) voor de ZIP-SVG-variant en previews. */
export function qrStyledSvg(url: string, style: QrRenderStyle = {}): string {
  return renderStyledQrSvg(qrMatrix(url), { ...style, pixelSize: 640 });
}

/** Gestylde SVG als bytes (ZIP-SVG-variant). */
export function qrSvgBytes(url: string, style: QrRenderStyle = {}): Uint8Array {
  return new Uint8Array(Buffer.from(qrStyledSvg(url, style), "utf-8"));
}

/** Hoge-resolutie PNG (gestyled) via resvg, voor de ZIP-PNG-variant + download. */
export function qrPngBytes(url: string, style: QrRenderStyle = {}): Uint8Array {
  const svg = renderStyledQrSvg(qrMatrix(url), { ...style, pixelSize: 640 });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 640 } }).render().asPng();
  return new Uint8Array(png);
}
