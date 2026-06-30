import { z } from "zod";

/**
 * Gedeelde bulk-import-logica voor leden. **Géén `server-only`**: zowel de
 * client-wizard (`components/member/import/*`) als de server-action
 * (`app/owner/members/import/actions.ts`) gebruiken dezelfde veld-definities,
 * kolom-herkenning, parsers en validatie. Eén bron van waarheid.
 */

export type ImportFieldKey =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "birthDate"
  | "gender"
  | "memberNumber"
  | "role";

export type ImportField = {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  /** Kolomnaam-aliassen (lowercase, genormaliseerd) voor auto-herkenning. */
  aliases: string[];
  /** Voorbeeldwaarde voor de template. */
  example: string;
};

/** Doelvelden van de import — bron van waarheid voor mapping én template. */
export const IMPORT_FIELDS: ImportField[] = [
  {
    key: "firstName",
    label: "Voornaam",
    required: true,
    aliases: ["voornaam", "first name", "firstname", "first", "naam", "given name"],
    example: "Jan",
  },
  {
    key: "lastName",
    label: "Achternaam",
    required: false,
    aliases: ["achternaam", "last name", "lastname", "last", "surname", "family name"],
    example: "de Vries",
  },
  {
    key: "email",
    label: "E-mailadres",
    required: true,
    aliases: ["email", "e-mail", "emailadres", "e-mailadres", "mail", "e mail"],
    example: "jan@voorbeeld.nl",
  },
  {
    key: "phone",
    label: "Telefoonnummer",
    required: false,
    aliases: ["telefoon", "telefoonnummer", "phone", "phone number", "mobiel", "gsm", "tel"],
    example: "+31 6 12345678",
  },
  {
    key: "birthDate",
    label: "Geboortedatum",
    required: false,
    aliases: ["geboortedatum", "geboorte", "birthdate", "birth date", "dob", "date of birth", "verjaardag"],
    example: "1990-05-17",
  },
  {
    key: "gender",
    label: "Geslacht",
    required: false,
    aliases: ["geslacht", "gender", "sekse", "sex"],
    example: "man",
  },
  {
    key: "memberNumber",
    label: "Lidnummer",
    required: false,
    aliases: ["lidnummer", "lidnr", "member number", "membernumber", "member id", "memberid", "nummer"],
    example: "FP-00123",
  },
  {
    key: "role",
    label: "Rol",
    required: false,
    aliases: ["rol", "role", "type", "soort"],
    example: "lid",
  },
];

export const IMPORT_FIELD_BY_KEY: Record<ImportFieldKey, ImportField> = Object.fromEntries(
  IMPORT_FIELDS.map((f) => [f.key, f])
) as Record<ImportFieldKey, ImportField>;

/** Mapping van bron-kolomindex → doelveld (of null = negeren). */
export type ColumnMapping = (ImportFieldKey | null)[];

/** Genormaliseerde header voor vergelijking (lowercase, trim, geen leestekens). */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Stelt automatisch een kolom→veld-mapping voor op basis van de headers.
 * Exacte alias-match wint; daarna een "bevat"-match. Elk veld wordt hoogstens
 * één keer gekoppeld (de eerste/beste kolom).
 */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const used = new Set<ImportFieldKey>();
  const mapping: ColumnMapping = headers.map(() => null);

  // Pas 1: exacte alias-match.
  headers.forEach((header, i) => {
    const norm = normalizeHeader(header);
    for (const field of IMPORT_FIELDS) {
      if (used.has(field.key)) continue;
      if (field.aliases.includes(norm)) {
        mapping[i] = field.key;
        used.add(field.key);
        break;
      }
    }
  });

  // Pas 2: gedeeltelijke match (header bevat alias of andersom).
  headers.forEach((header, i) => {
    if (mapping[i]) return;
    const norm = normalizeHeader(header);
    for (const field of IMPORT_FIELDS) {
      if (used.has(field.key)) continue;
      if (field.aliases.some((a) => norm.includes(a) || a.includes(norm))) {
        mapping[i] = field.key;
        used.add(field.key);
        break;
      }
    }
  });

  return mapping;
}

// --- Parsers -----------------------------------------------------------------

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type GenderValue = "MAN" | "VROUW" | "NON_BINAIR" | "ONBEKEND";

const GENDER_MAP: Record<string, GenderValue> = {
  man: "MAN", m: "MAN", male: "MAN", jongen: "MAN", heer: "MAN",
  vrouw: "VROUW", v: "VROUW", f: "VROUW", female: "VROUW", w: "VROUW", woman: "VROUW", dame: "VROUW",
  "non-binair": "NON_BINAIR", "non binair": "NON_BINAIR", nonbinary: "NON_BINAIR",
  "non-binary": "NON_BINAIR", x: "NON_BINAIR", divers: "NON_BINAIR", other: "NON_BINAIR", anders: "NON_BINAIR",
  onbekend: "ONBEKEND", unknown: "ONBEKEND", "": "ONBEKEND",
};

/** Geslacht parsen; `null` = onherkenbare (niet-lege) invoer → waarschuwing. */
export function parseGender(raw: string): GenderValue | null {
  const key = raw.trim().toLowerCase();
  if (key === "") return "ONBEKEND";
  return GENDER_MAP[key] ?? null;
}

/**
 * Geboortedatum parsen. Accepteert `jjjj-mm-dd`, `dd-mm-jjjj`, `dd/mm/jjjj` en
 * Excel-serienummers. Retourneert een ISO-datumstring (`jjjj-mm-dd`) of `null`
 * bij een onherkenbare (niet-lege) waarde.
 */
export function parseBirthDate(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return "";

  // Excel slaat datums op als serienummer (dagen sinds 1899-12-30).
  if (/^\d{4,6}(\.\d+)?$/.test(v)) {
    const serial = Number(v);
    if (serial > 0 && serial < 100000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  let y: number, m: number, d: number;
  const iso = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const dmy = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (iso) {
    [, y, m, d] = iso.map(Number) as [number, number, number, number];
  } else if (dmy) {
    [, d, m, y] = dmy.map(Number) as [number, number, number, number];
  } else {
    return null;
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null; // bv. 31-02
  }
  // Plausibele leeftijd: tussen ~1900 en nu.
  if (y < 1900 || date.getTime() > Date.now()) return null;
  return date.toISOString().slice(0, 10);
}

export type RoleValue = "TENANT_ADMIN" | "TENANT_MEMBER";

export function parseRole(raw: string): RoleValue {
  const v = raw.trim().toLowerCase();
  if (["admin", "beheerder", "tenant_admin", "owner", "eigenaar", "manager"].includes(v)) {
    return "TENANT_ADMIN";
  }
  return "TENANT_MEMBER";
}

// --- Validatie ---------------------------------------------------------------

/** Eén rij ruwe celwaarden (één per bron-kolom). */
export type RawRow = string[];

/** Genormaliseerde, geïmporteerde waarden van één rij. */
export type ImportValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string; // ISO `jjjj-mm-dd` of ""
  gender: GenderValue;
  memberNumber: string;
  role: RoleValue;
};

export type RowIssue = { field: ImportFieldKey | "row"; message: string };

export type ValidatedRow = {
  /** 1-based rijnummer in het bronbestand (excl. headerrij). */
  rowNumber: number;
  values: ImportValues;
  errors: RowIssue[];
  warnings: RowIssue[];
  /** Wordt deze rij overgeslagen (lege regel of harde fout)? */
  skipped: boolean;
};

export type ValidationContext = {
  /** Genormaliseerde e-mails die al als lid bestaan in de tenant. */
  existingEmails: Set<string>;
};

function cell(row: RawRow, mapping: ColumnMapping, key: ImportFieldKey): string {
  const idx = mapping.indexOf(key);
  if (idx < 0) return "";
  return (row[idx] ?? "").toString();
}

/**
 * Valideert alle rijen tegen de mapping en context. Verzamelt fouten/
 * waarschuwingen per rij — één foute rij blokkeert de rest nooit. Dubbele
 * e-mails binnen het bestand én t.o.v. bestaande leden worden gemarkeerd.
 */
export function validateRows(
  rows: RawRow[],
  mapping: ColumnMapping,
  ctx: ValidationContext
): ValidatedRow[] {
  const seenEmails = new Map<string, number>(); // email → eerste rijnummer
  const seenMemberNumbers = new Map<string, number>();

  return rows.map((row, i) => {
    const rowNumber = i + 1;
    const errors: RowIssue[] = [];
    const warnings: RowIssue[] = [];

    const rawFirst = cell(row, mapping, "firstName").trim();
    const rawLast = cell(row, mapping, "lastName").trim();
    const rawEmail = cell(row, mapping, "email").trim();
    const rawPhone = cell(row, mapping, "phone").trim();
    const rawBirth = cell(row, mapping, "birthDate").trim();
    const rawGender = cell(row, mapping, "gender").trim();
    const rawMember = cell(row, mapping, "memberNumber").trim();
    const rawRole = cell(row, mapping, "role").trim();

    // Lege regel: alle gemapte cellen leeg → overslaan, geen fout.
    const allEmpty = [rawFirst, rawLast, rawEmail, rawPhone, rawBirth, rawGender, rawMember].every(
      (v) => v === ""
    );
    if (allEmpty) {
      return {
        rowNumber,
        values: emptyValues(),
        errors: [],
        warnings: [{ field: "row", message: "Lege regel — overgeslagen" }],
        skipped: true,
      };
    }

    // Verplicht: voornaam.
    if (rawFirst === "") errors.push({ field: "firstName", message: "Voornaam ontbreekt" });

    // Verplicht: geldige, unieke e-mail.
    const email = normalizeEmail(rawEmail);
    if (email === "") {
      errors.push({ field: "email", message: "E-mailadres ontbreekt" });
    } else if (!EMAIL_RE.test(email)) {
      errors.push({ field: "email", message: `Ongeldig e-mailadres "${rawEmail}"` });
    } else if (ctx.existingEmails.has(email)) {
      errors.push({ field: "email", message: "Bestaat al als lid in deze sportschool" });
    } else if (seenEmails.has(email)) {
      errors.push({
        field: "email",
        message: `Dubbel e-mailadres (ook op regel ${seenEmails.get(email)})`,
      });
    } else {
      seenEmails.set(email, rowNumber);
    }

    // Optioneel: geboortedatum.
    let birthDate = "";
    if (rawBirth !== "") {
      const parsed = parseBirthDate(rawBirth);
      if (parsed === null) {
        warnings.push({ field: "birthDate", message: `Onleesbare datum "${rawBirth}" — genegeerd` });
      } else {
        birthDate = parsed;
      }
    }

    // Optioneel: geslacht.
    let gender: GenderValue = "ONBEKEND";
    if (rawGender !== "") {
      const parsed = parseGender(rawGender);
      if (parsed === null) {
        warnings.push({ field: "gender", message: `Onbekend geslacht "${rawGender}" — genegeerd` });
      } else {
        gender = parsed;
      }
    }

    // Optioneel: uniek lidnummer (binnen bestand; DB dwingt tenant-uniciteit af).
    if (rawMember !== "") {
      if (seenMemberNumbers.has(rawMember)) {
        warnings.push({
          field: "memberNumber",
          message: `Dubbel lidnummer (ook op regel ${seenMemberNumbers.get(rawMember)})`,
        });
      } else {
        seenMemberNumbers.set(rawMember, rowNumber);
      }
    }

    // Optioneel: ontbrekende achternaam → waarschuwing (niet blokkerend).
    if (rawLast === "") {
      warnings.push({ field: "lastName", message: "Achternaam ontbreekt" });
    }

    const values: ImportValues = {
      firstName: rawFirst,
      lastName: rawLast,
      email,
      phone: rawPhone,
      birthDate,
      gender,
      memberNumber: rawMember,
      role: parseRole(rawRole),
    };

    return { rowNumber, values, errors, warnings, skipped: errors.length > 0 };
  });
}

function emptyValues(): ImportValues {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    birthDate: "",
    gender: "ONBEKEND",
    memberNumber: "",
    role: "TENANT_MEMBER",
  };
}

export type ImportSummary = {
  total: number;
  valid: number;
  errored: number;
  warned: number;
  skipped: number;
};

/** Telt de uitkomst van een validatie-run voor de preview-stap. */
export function summarize(rows: ValidatedRow[]): ImportSummary {
  let valid = 0,
    errored = 0,
    warned = 0,
    skipped = 0;
  for (const r of rows) {
    if (r.skipped && r.errors.length === 0) skipped++;
    else if (r.errors.length > 0) errored++;
    else {
      valid++;
      if (r.warnings.length > 0) warned++;
    }
  }
  return { total: rows.length, valid, errored, warned, skipped };
}

// --- Server-side hervalidatie ------------------------------------------------

/** Strikt schema voor de server-action (defense-in-depth na client-validatie). */
export const importRowSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  gender: z.enum(["MAN", "VROUW", "NON_BINAIR", "ONBEKEND"]),
  memberNumber: z.string().trim().max(60),
  role: z.enum(["TENANT_ADMIN", "TENANT_MEMBER"]),
});

export type ImportRowInput = z.infer<typeof importRowSchema>;

// --- Template ----------------------------------------------------------------

/** Kolomnamen voor het voorbeeldbestand (Nederlandse labels). */
export const TEMPLATE_HEADERS = IMPORT_FIELDS.map((f) => f.label);

/** Twee voorbeeldrijen voor het template. */
export const TEMPLATE_SAMPLE_ROWS: string[][] = [
  ["Jan", "de Vries", "jan@voorbeeld.nl", "+31 6 12345678", "1990-05-17", "man", "FP-00123", "lid"],
  ["Sanne", "Bakker", "sanne@voorbeeld.nl", "+31 6 87654321", "1995-11-02", "vrouw", "FP-00124", "lid"],
];

/** RFC 4180-ish CSV-escape. */
function csvEscape(value: string): string {
  if (/[",\n\r;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Bouwt de CSV-template (headers + voorbeeldrijen). */
export function buildCsvTemplate(): string {
  const lines = [TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE_ROWS].map((row) =>
    row.map(csvEscape).join(",")
  );
  // BOM zodat Excel UTF-8 correct herkent.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
