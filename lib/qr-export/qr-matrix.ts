// Pure QR-matrix-generatie (géén server-only). `qrcode` werkt zowel op de server
// als in de browser → de client-preview en de server-export delen dezelfde matrix.
import QRCode from "qrcode";

// Foutcorrectie "H" (~30% herstel): ruim genoeg om het centrale logo-overlay en
// gelamineerde/vervuilde labels te verdragen.
export type QrErrorCorrection = "L" | "M" | "Q" | "H";
export const DEFAULT_ECC: QrErrorCorrection = "H";

export type QrModules = {
  /** Aantal modules per zijde (exclusief quiet zone). */
  size: number;
  /** `true` = donkere module. Index = row * size + col. */
  dark: boolean[];
};

/** Levert de QR-module-matrix zodat we er vector-geometrie van kunnen tekenen. */
export function qrMatrix(url: string, ecc: QrErrorCorrection = DEFAULT_ECC): QrModules {
  const qr = QRCode.create(url, { errorCorrectionLevel: ecc });
  const size = qr.modules.size;
  const dark: boolean[] = new Array(size * size);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      dark[row * size + col] = qr.modules.get(row, col) === 1;
    }
  }
  return { size, dark };
}
