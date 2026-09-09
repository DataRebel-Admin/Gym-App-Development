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
  getMemberDayTemplate,
} from "../lib/member-day-templates";
import { TRAINING_GOALS } from "../lib/training-goals";
import { SCHEMA_BADGES } from "../lib/schema-badges";
import { LIBRARY_TEMPLATE_PHOTOS } from "../lib/schema-image";
import { parseTemplateReps } from "../lib/exercise-library/mapping";
import { MEMBER_DAY_LIBRARY_WHERE } from "../lib/member-library-rules";

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
