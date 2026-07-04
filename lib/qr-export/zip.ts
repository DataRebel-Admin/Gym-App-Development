// Minimale, dependency-vrije ZIP-writer (store / geen compressie). PNG- en
// SVG-bestanden zijn al compact (PNG gecomprimeerd, SVG klein), dus "stored"
// levert een geldige, universeel uitpakbare .zip zonder externe library.
//
// Ondersteunt submappen via "/" in de naam (bv. "fitpower/Loopband-01.png").
// Alleen ASCII/UTF-8 namen; datum vast op een neutrale waarde (reproduceerbaar).

export type ZipEntry = { name: string; data: Uint8Array };

// --- CRC32 (standaardtabel) ------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// --- Little-endian schrijvers ----------------------------------------------
function u16(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff];
}
function u32(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

/**
 * Bouwt een geldig ZIP-archief (store-methode) uit de gegeven bestanden.
 * Retourneert de volledige archief-bytes.
 */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: number[][] = [];
  const centralParts: number[][] = [];
  let offset = 0;

  // Vaste DOS-tijd/-datum (2020-01-01 00:00) — reproduceerbare output.
  const dosTime = 0;
  const dosDate = ((2020 - 1980) << 9) | (1 << 5) | 1;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    // Local file header
    const local: number[] = [];
    local.push(...u32(0x04034b50));
    local.push(...u16(20)); // version needed
    local.push(...u16(0x0800)); // UTF-8 flag
    local.push(...u16(0)); // method: store
    local.push(...u16(dosTime));
    local.push(...u16(dosDate));
    local.push(...u32(crc));
    local.push(...u32(data.length)); // compressed size
    local.push(...u32(data.length)); // uncompressed size
    local.push(...u16(nameBytes.length));
    local.push(...u16(0)); // extra length
    local.push(...nameBytes);
    const localHeaderLen = local.length;
    // data volgt direct na de header
    const localWithData: number[] = local.concat(Array.from(data));
    localParts.push(localWithData);

    // Central directory record
    const central: number[] = [];
    central.push(...u32(0x02014b50));
    central.push(...u16(20)); // version made by
    central.push(...u16(20)); // version needed
    central.push(...u16(0x0800)); // UTF-8 flag
    central.push(...u16(0)); // method: store
    central.push(...u16(dosTime));
    central.push(...u16(dosDate));
    central.push(...u32(crc));
    central.push(...u32(data.length));
    central.push(...u32(data.length));
    central.push(...u16(nameBytes.length));
    central.push(...u16(0)); // extra length
    central.push(...u16(0)); // comment length
    central.push(...u16(0)); // disk number start
    central.push(...u16(0)); // internal attrs
    central.push(...u32(0)); // external attrs
    central.push(...u32(offset)); // local header offset
    central.push(...nameBytes);
    centralParts.push(central);

    offset += localHeaderLen + data.length;
  }

  const centralStart = offset;
  const centralBytes = centralParts.flat();
  const centralSize = centralBytes.length;

  // End of central directory record
  const eocd: number[] = [];
  eocd.push(...u32(0x06054b50));
  eocd.push(...u16(0)); // disk number
  eocd.push(...u16(0)); // central dir start disk
  eocd.push(...u16(entries.length));
  eocd.push(...u16(entries.length));
  eocd.push(...u32(centralSize));
  eocd.push(...u32(centralStart));
  eocd.push(...u16(0)); // comment length

  const all = localParts.flat().concat(centralBytes, eocd);
  return Uint8Array.from(all);
}
