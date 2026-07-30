import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEMBER_LIBRARY_WHERE,
  isInMemberLibrary,
  type MemberLibraryCandidate,
} from "../lib/member-library-rules";

// De lid-library kent één toegangsregel, en die geldt op twee plekken: bij het
// TONEN (overzicht/detail) en bij het OVERNEMEN (`startMemberSchema` valideert de
// bron opnieuw). Lopen die uit elkaar, dan toont de app een schema dat je niet
// kunt kopiëren — of laat het iets kopiëren dat niet is vrijgegeven. Vandaar één
// constante + dit predicaat, en deze test die ze aan elkaar vastlegt.

const ROWS: (MemberLibraryCandidate & { name: string })[] = [
  { name: "Full body vrijgegeven", isLibrary: true, memberVisible: true, kind: "SCHEMA" },
  { name: "Full body verborgen", isLibrary: true, memberVisible: false, kind: "SCHEMA" },
  // Losse herbruikbare trainingsdag: wél vrijgegeven, maar geen heel schema.
  { name: "Push-dag (dagsjabloon)", isLibrary: true, memberVisible: true, kind: "DAY" },
  // Persoonlijk lid-schema: een kloon draagt memberVisible mee uit z'n bron, dus
  // `isLibrary` is hier de enige verdediging tegen het lekken van een lid-schema.
  { name: "Schema van Jan", isLibrary: false, memberVisible: true, kind: "SCHEMA" },
];

test("MEMBER_LIBRARY_WHERE eist alle drie de voorwaarden", () => {
  assert.deepEqual(
    { ...MEMBER_LIBRARY_WHERE },
    { isLibrary: true, memberVisible: true, kind: "SCHEMA" }
  );
});

test("isInMemberLibrary matcht precies de vrijgegeven schema's", () => {
  assert.deepEqual(
    ROWS.filter(isInMemberLibrary).map((r) => r.name),
    ["Full body vrijgegeven"]
  );
});

// Regressie: `memberVisible` alléén is niet genoeg. Een dagsjabloon of een
// persoonlijk lid-schema mag nooit in de library opduiken.
test("predicaat volgt de where-clause veld voor veld", () => {
  const matchesWhere = (r: MemberLibraryCandidate) =>
    Object.entries(MEMBER_LIBRARY_WHERE).every(
      ([k, v]) => r[k as keyof MemberLibraryCandidate] === v
    );

  assert.deepEqual(
    ROWS.filter(isInMemberLibrary).map((r) => r.name),
    ROWS.filter(matchesWhere).map((r) => r.name)
  );
});
