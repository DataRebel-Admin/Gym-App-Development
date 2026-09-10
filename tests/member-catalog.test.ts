import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG_LEVEL_LABELS,
  catalogHref,
  catalogStartSource,
  filterCatalog,
  hasActiveCatalogFilter,
  parseCatalogFilters,
  parseCatalogSource,
  rowDaysPerWeek,
  type CatalogRow,
} from "../lib/member-catalog-core";
import {
  MEMBER_DAY_TEMPLATES,
  dayTemplateSlugs,
  dayTemplateItemGroup,
  getMemberDayTemplate,
} from "../lib/member-day-templates";
import { TRAINING_GOALS } from "../lib/training-goals";
import { SCHEMA_BADGES } from "../lib/schema-badges";
import { LIBRARY_TEMPLATE_PHOTOS } from "../lib/schema-image";
import { parseTemplateReps } from "../lib/exercise-library/mapping";
import { MEMBER_DAY_LIBRARY_WHERE } from "../lib/member-library-rules";
import {
  LIBRARY_TEMPLATE_NL,
  libraryTemplateNl,
  libraryTemplateDayName,
  isLibraryTemplateHidden,
  swapLibraryExerciseSlug,
} from "../lib/library-template-nl";

// ---------------------------------------------------------------------------
// Dag-template-registry: elke regel moet bij overname iets bruikbaars opleveren.
// De slugs zelf zijn geverifieerd tegen de RepDB-bundel bij het cureren; deze
// tests bewaken de registry-invarianten die zonder DB te toetsen zijn.
// ---------------------------------------------------------------------------

test("dag-templates: unieke keys en minstens één oefening per template", () => {
  const keys = MEMBER_DAY_TEMPLATES.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const t of MEMBER_DAY_TEMPLATES) {
    assert.ok(t.items.length >= 1, `${t.key}: leeg dag-template`);
    assert.ok(t.name.trim() !== "" && t.description.trim() !== "", t.key);
    assert.ok(t.minutes > 0, `${t.key}: duurindicatie ontbreekt`);
  }
});

test("dag-templates: doelen, badges en foto's verwijzen naar bestaande registries", () => {
  for (const t of MEMBER_DAY_TEMPLATES) {
    assert.ok(t.goals.length >= 1, `${t.key}: geen doel`);
    for (const g of t.goals) assert.ok(g in TRAINING_GOALS, `${t.key}: onbekend doel ${g}`);
    for (const b of t.badges) assert.ok(b in SCHEMA_BADGES, `${t.key}: onbekende badge ${b}`);
    assert.ok(
      t.photoSlug in LIBRARY_TEMPLATE_PHOTOS,
      `${t.key}: onbekende foto-slug ${t.photoSlug}`
    );
  }
});

test("dag-templates: items hebben bruikbare sets/reps/rust", () => {
  for (const t of MEMBER_DAY_TEMPLATES) {
    for (const it of t.items) {
      assert.ok(it.slug.trim() !== "", t.key);
      assert.ok(it.sets >= 1 && it.sets <= 10, `${t.key}/${it.slug}: sets ${it.sets}`);
      assert.ok(it.restSeconds >= 0, `${t.key}/${it.slug}`);
      // De reps-notatie moet door de gedeelde parser heen kunnen: een leidend
      // getal in de kolom, of anders een notitie (bv. "AMRAP") die meegaat.
      const parsed = parseTemplateReps(it.reps);
      assert.ok(
        parsed.reps != null || parsed.note != null,
        `${t.key}/${it.slug}: onparseerbare reps "${it.reps}"`
      );
    }
  }
});

test("thema-covers horen bij een dag-template en andersom", () => {
  // De `theme-`-sleutels in LIBRARY_TEMPLATE_PHOTOS bestaan puur voor de
  // dag-templates. Een cover zonder gebruiker betekent een geupload bestand dat
  // niemand toont; een dag-template dat naar een niet-bestaande cover wijst
  // valt in de UI terug op het doel en dus op een willekeurige foto.
  const used = new Set(MEMBER_DAY_TEMPLATES.map((t) => t.photoSlug));
  const themeKeys = Object.keys(LIBRARY_TEMPLATE_PHOTOS).filter((k) => k.startsWith("theme-"));
  assert.ok(themeKeys.length > 0, "geen thema-covers gevonden");
  for (const key of themeKeys) {
    assert.ok(used.has(key), `cover ${key} wordt door geen enkel dag-template gebruikt`);
  }
  for (const t of MEMBER_DAY_TEMPLATES) {
    const photo = LIBRARY_TEMPLATE_PHOTOS[t.photoSlug];
    assert.ok(photo, `${t.key}: onbekende foto ${t.photoSlug}`);
    assert.equal(photo.slug, t.photoSlug, `${t.key}: foto-record en sleutel lopen uiteen`);
  }
});

test("dag-templates: niveau is een bekende waarde", () => {
  for (const t of MEMBER_DAY_TEMPLATES) {
    if (t.level === undefined) continue;
    assert.ok(
      ["beginner", "intermediate", "advanced"].includes(t.level),
      `${t.key}: onbekend niveau ${t.level}`
    );
  }
});

test("dag-templates: geen gedachtestreepjes in zichtbare tekst", () => {
  // Huisstijl: zichtbare app-tekst gebruikt komma, dubbele punt of punt.
  const dash = /[—–]/;
  for (const t of MEMBER_DAY_TEMPLATES) {
    assert.ok(!dash.test(t.name), `${t.key}: streepje in naam`);
    assert.ok(!dash.test(t.description), `${t.key}: streepje in omschrijving`);
    for (const it of t.items) {
      assert.ok(!dash.test(it.notes ?? ""), `${t.key}/${it.slug}: streepje in notitie`);
    }
  }
});

test("dag-templates: tijd staat in seconden, nooit in minuten", () => {
  // `parseTemplateReps` pakt het leidende getal als doelaantal herhalingen, dus
  // "4min" zou als 4 herhalingen in het schema van het lid landen.
  for (const t of MEMBER_DAY_TEMPLATES) {
    for (const it of t.items) {
      assert.ok(!/min/i.test(it.reps), `${t.key}/${it.slug}: reps "${it.reps}" in minuten`);
    }
  }
});

test("dag-templates: groepen verwijzen naar elkaar en tellen minstens twee leden", () => {
  for (const t of MEMBER_DAY_TEMPLATES) {
    const used = new Set(t.items.map((i) => i.group).filter(Boolean) as string[]);
    for (const key of used) {
      assert.ok(t.groups?.[key], `${t.key}: item verwijst naar onbekende groep ${key}`);
      const members = t.items.filter((i) => i.group === key);
      assert.ok(members.length >= 2, `${t.key}: groep ${key} heeft ${members.length} lid`);
      // Groepsleden moeten aaneengesloten staan: de app leidt een groep af uit
      // opeenvolgende items met dezelfde groupId (lib/exercise-groups.ts).
      const idx = t.items.map((i, n) => (i.group === key ? n : -1)).filter((n) => n >= 0);
      assert.deepEqual(
        idx,
        Array.from({ length: idx.length }, (_, n) => idx[0] + n),
        `${t.key}: groep ${key} staat niet aaneengesloten`
      );
    }
    for (const key of Object.keys(t.groups ?? {})) {
      assert.ok(used.has(key), `${t.key}: groep ${key} wordt door geen item gebruikt`);
    }
  }
});

test("dayTemplateItemGroup levert de groep alleen bij een echte groep", () => {
  const cindy = getMemberDayTemplate("cindy-amrap-20");
  assert.ok(cindy);
  const warmup = cindy.items.find((i) => !i.group);
  assert.ok(warmup);
  assert.equal(dayTemplateItemGroup(cindy, warmup), null);
  const wod = cindy.items.find((i) => i.group === "wod");
  assert.ok(wod);
  assert.equal(dayTemplateItemGroup(cindy, wod)?.type, "amrap");
  // Eenling in een groep telt niet als groep (self-healing, zoals de editor).
  const solo = { slug: "plank", sets: 1, reps: "30s", restSeconds: 0, group: "solo" };
  const fake = { ...cindy, items: [...cindy.items, solo], groups: { ...cindy.groups } };
  assert.equal(dayTemplateItemGroup(fake, solo), null);
});

test("dayTemplateSlugs ontdubbelt en getMemberDayTemplate vindt op key", () => {
  const core = getMemberDayTemplate("core-15");
  assert.ok(core);
  assert.equal(new Set(dayTemplateSlugs(core)).size, dayTemplateSlugs(core).length);
  assert.equal(getMemberDayTemplate("bestaat-niet"), undefined);
});

// ---------------------------------------------------------------------------
// Pure catalogus-kern: refs, filters, kader-check.
// ---------------------------------------------------------------------------

function row(patch: Partial<CatalogRow>): CatalogRow {
  return {
    source: "repdb",
    id: "x",
    type: "week",
    name: "Testschema",
    description: null,
    goals: [],
    badges: [],
    dayCount: 3,
    exerciseCount: 12,
    daysPerWeek: null,
    level: null,
    minutes: null,
    validityWeeks: null,
    image: null,
    terms: [],
    ...patch,
  };
}

test("parseCatalogSource accepteert alleen bekende bronnen", () => {
  assert.equal(parseCatalogSource("repdb"), "repdb");
  assert.equal(parseCatalogSource("tenantday"), "tenantday");
  assert.equal(parseCatalogSource("evil"), null);
  assert.equal(parseCatalogSource(undefined), null);
});

test("catalogStartSource mapt tenant op de bestaande template:-bron", () => {
  assert.equal(catalogStartSource(row({ source: "tenant", id: "abc" })), "template:abc");
  assert.equal(catalogStartSource(row({ source: "repdb", id: "ppl" })), "repdb:ppl");
  assert.equal(catalogStartSource(row({ source: "day", id: "push-dag" })), "day:push-dag");
  assert.equal(catalogStartSource(row({ source: "tenantday", id: "t1" })), "tenantday:t1");
});

test("catalogHref codeert het id", () => {
  assert.equal(catalogHref(row({ source: "day", id: "push dag" })), "/member/schema/templates/day/push%20dag");
});

test("rowDaysPerWeek: aanbevolen frequentie wint van het dag-aantal", () => {
  assert.equal(rowDaysPerWeek(row({ dayCount: 3, daysPerWeek: 6 })), 6);
  assert.equal(rowDaysPerWeek(row({ dayCount: 3, daysPerWeek: null })), 3);
});

test("parseCatalogFilters valideert defensief", () => {
  assert.deepEqual(parseCatalogFilters({}), {
    type: null,
    goal: null,
    days: null,
    level: null,
    q: null,
  });
  const f = parseCatalogFilters({
    type: "day",
    goal: "muscle",
    dagen: "5",
    niveau: "beginner",
    q: " squat ",
  });
  assert.deepEqual(f, { type: "day", goal: "muscle", days: "5", level: "beginner", q: "squat" });
  // Onbekende waarden vallen weg in plaats van te crashen of te lekken.
  const bad = parseCatalogFilters({ type: "evil", dagen: "9", niveau: "pro" });
  assert.deepEqual(bad, { type: null, goal: null, days: null, level: null, q: null });
  assert.equal(hasActiveCatalogFilter(bad), false);
  assert.equal(hasActiveCatalogFilter(f), true);
});

test("filterCatalog: type, doel, dagen, niveau en zoekterm versmallen", () => {
  const rows = [
    row({ id: "ppl", type: "week", goals: ["muscle"], dayCount: 3, daysPerWeek: 6, level: "intermediate", name: "PPL 6-daags" }),
    row({ id: "sl", type: "week", goals: ["strength"], dayCount: 2, daysPerWeek: 3, level: "beginner", name: "StrongLifts" }),
    row({ id: "push", type: "day", goals: ["muscle"], dayCount: 1, level: null, name: "Push-dag" }),
  ];
  const none = { type: null, goal: null, days: null, level: null, q: null } as const;

  assert.deepEqual(filterCatalog(rows, { ...none, type: "day" }).map((r) => r.id), ["push"]);
  assert.deepEqual(
    filterCatalog(rows, { ...none, goal: "muscle" }).map((r) => r.id),
    ["ppl", "push"]
  );
  // Dagen filtert op de effectieve frequentie (daysPerWeek ?? dayCount).
  assert.deepEqual(filterCatalog(rows, { ...none, days: "5" }).map((r) => r.id), ["ppl"]);
  assert.deepEqual(filterCatalog(rows, { ...none, days: "1" }).map((r) => r.id), ["push"]);
  // Niveau: rijen zonder niveau vallen weg zodra erop gefilterd wordt.
  assert.deepEqual(
    filterCatalog(rows, { ...none, level: "beginner" }).map((r) => r.id),
    ["sl"]
  );
  assert.deepEqual(filterCatalog(rows, { ...none, q: "strong" }).map((r) => r.id), ["sl"]);
});

test("filterCatalog zoekt fuzzy: tikfout, woordvolgorde en NL naar EN", () => {
  const none = { type: null, goal: null, days: null, level: null, q: null } as const;
  const rows = [
    row({ id: "beendag", source: "day", type: "day", name: "Beendag", terms: ["squat", "leg-press"] }),
    row({
      id: "borst",
      source: "day",
      type: "day",
      name: "Borst en rug supersets",
      terms: ["bench-press", "pull-up"],
    }),
    row({ id: "ppl", source: "repdb", name: "Push pull legs, 6x per week", terms: ["Push", "Pull"] }),
  ];
  const ids = (q: string) => filterCatalog(rows, { ...none, q }).map((r) => r.id);

  // Tikfout in de naam: de kale includes vond dit nooit.
  assert.deepEqual(ids("beendg"), ["beendag"]);
  // Woordvolgorde maakt niet uit.
  assert.deepEqual(ids("supersets borst"), ["borst"]);
  // Nederlandse zoekterm landt via NL_QUERY_TERMS op de Engelse oefening-slug.
  assert.deepEqual(ids("bankdrukken"), ["borst"]);
  // Oefening-slug is doorzoekbaar, ook zonder streepje.
  assert.deepEqual(ids("leg press"), ["beendag"]);
  // Niets gevonden blijft niets, geen stille volledige lijst.
  assert.deepEqual(ids("onvindbaarwoord"), []);
});

test("filterCatalog: zonder zoekterm blijft de aangeleverde volgorde staan", () => {
  const none = { type: null, goal: null, days: null, level: null, q: null } as const;
  const rows = [row({ id: "c", name: "C" }), row({ id: "a", name: "A" }), row({ id: "b", name: "B" })];
  assert.deepEqual(filterCatalog(rows, none).map((r) => r.id), ["c", "a", "b"]);
});

test("filterCatalog: dezelfde id bij twee bronnen blijft uit elkaar", () => {
  // De sleutel voor de matcher draagt de bron; anders overschrijft een
  // vrijgegeven gym-dag een gecureerd dag-template met dezelfde key.
  const none = { type: null, goal: null, days: null, level: null, q: null } as const;
  const rows = [
    row({ id: "core", source: "day", type: "day", name: "Core 15 min" }),
    row({ id: "core", source: "tenantday", type: "day", name: "Core van de gym" }),
  ];
  assert.equal(filterCatalog(rows, { ...none, q: "core" }).length, 2);
});

// ---------------------------------------------------------------------------
// Vrijgegeven gym-dag-templates: zelfde drieluik als MEMBER_LIBRARY_WHERE.
// ---------------------------------------------------------------------------

test("MEMBER_DAY_LIBRARY_WHERE eist library + vrijgegeven + kind DAY", () => {
  assert.deepEqual(
    { ...MEMBER_DAY_LIBRARY_WHERE },
    { isLibrary: true, memberVisible: true, kind: "DAY" }
  );
});

test("elk niveau heeft een NL-label", () => {
  assert.deepEqual(Object.keys(CATALOG_LEVEL_LABELS), ["beginner", "intermediate", "advanced"]);
});

// ---------------------------------------------------------------------------
// Nederlandse curatie-laag over de RepDB-voorbeeldschema's.
// ---------------------------------------------------------------------------

test("RepDB-overlay: elke rij heeft een bruikbare Nederlandse naam en omschrijving", () => {
  const dash = /[—–]/;
  for (const [key, nl] of Object.entries(LIBRARY_TEMPLATE_NL)) {
    assert.equal(nl.slug, key, `${key}: sleutel en slug lopen uiteen`);
    assert.ok(nl.name.trim() !== "", `${key}: lege naam`);
    assert.ok(nl.description.trim() !== "", `${key}: lege omschrijving`);
    assert.ok(nl.name.length <= 34, `${key}: naam ${nl.name.length} tekens: "${nl.name}"`);
    // De dataset-namen die deze laag vervangt zaten juist vol gedachtestreepjes.
    assert.ok(!dash.test(nl.name), `${key}: streepje in naam`);
    assert.ok(!dash.test(nl.description), `${key}: streepje in omschrijving`);
    for (const d of nl.dayNames ?? []) {
      assert.ok(d.trim() !== "" && !dash.test(d), `${key}: dagnaam "${d}"`);
    }
    if (nl.hidden) {
      assert.ok(nl.hiddenReason?.trim(), `${key}: verborgen zonder reden`);
    }
  }
});

test("RepDB-overlay: dagnamen vallen terug en slug-correcties werken", () => {
  assert.equal(libraryTemplateDayName("ppl-6-day-intermediate", 0, "Push"), "Push");
  // Buiten bereik of onbekend schema: de meegegeven terugval wint.
  assert.equal(libraryTemplateDayName("ppl-6-day-intermediate", 9, "Dag 10"), "Dag 10");
  assert.equal(libraryTemplateDayName("bestaat-niet", 0, "Dag 1"), "Dag 1");
  assert.equal(libraryTemplateDayName(null, 0, "Dag 1"), "Dag 1");

  // Datafout in de bundel: een schema zonder apparaten schreef een barbell squat voor.
  assert.equal(swapLibraryExerciseSlug("home-bodyweight-beginner", "squat"), "bodyweight-squat");
  assert.equal(swapLibraryExerciseSlug("home-bodyweight-beginner", "push-up"), "push-up");
  assert.equal(swapLibraryExerciseSlug("upper-lower-4-day", "squat"), "squat");
  assert.equal(swapLibraryExerciseSlug(null, "squat"), "squat");
});

test("RepDB-overlay: verbergen is opt-in en vindbaar", () => {
  assert.equal(isLibraryTemplateHidden("core-finisher-10min"), true);
  assert.equal(isLibraryTemplateHidden("upper-lower-4-day"), false);
  assert.equal(isLibraryTemplateHidden("bestaat-niet"), false);
  assert.equal(libraryTemplateNl("bestaat-niet"), null);
  const hidden = Object.values(LIBRARY_TEMPLATE_NL).filter((n) => n.hidden);
  assert.ok(hidden.length > 0 && hidden.length < Object.keys(LIBRARY_TEMPLATE_NL).length);
});
