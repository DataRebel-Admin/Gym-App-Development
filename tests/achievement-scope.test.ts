// Pure-logica-tests voor de trofee-scopes (lib/achievements/scope.ts) —
// spec-scenario (d): "trophy-scope LOCATION / ORGANIZATION / GLOBAL telt over de
// juiste set". Geen testframework-dependency: Node's `node:test` via tsx.
// Draaien: `npx tsx --test tests/achievement-scope.test.ts` (of `npm test`).
//
// De engine (lib/achievements/evaluate.ts) is server-only; hier testen we de
// pure activiteitenset-selectie + scope-sleutel die de engine autoritatief
// gebruikt — bewust zonder imports uit definitions.ts (dat icon-componenten
// via de @/-alias importeert en dus niet onder tsx laadt).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activitiesForScope,
  locationScopeKeyFor,
  type ScopedActivity,
} from "../lib/achievements/scope";

const ORG_A = "tenant-a";
const ORG_B = "tenant-b";
const CENTRUM = "a-centrum";
const ZUID = "a-zuid";

const activities: (ScopedActivity & { id: string })[] = [
  { id: "s1", tenantId: ORG_A, locationId: CENTRUM },
  { id: "s2", tenantId: ORG_A, locationId: CENTRUM },
  { id: "s3", tenantId: ORG_A, locationId: ZUID },
  // Rijen van een andere organisatie — mogen in géén enkele scope meetellen,
  // zelfs niet met een botsende locatie-id.
  { id: "x1", tenantId: ORG_B, locationId: CENTRUM },
  { id: "x2", tenantId: ORG_B, locationId: "b-hoofd" },
];

test("spec (d): LOCATION telt uitsluitend de activiteit op die ene vestiging", () => {
  const centrum = activitiesForScope("LOCATION", ORG_A, activities, CENTRUM);
  assert.deepEqual(centrum.map((a) => a.id), ["s1", "s2"]);

  const zuid = activitiesForScope("LOCATION", ORG_A, activities, ZUID);
  assert.deepEqual(zuid.map((a) => a.id), ["s3"]);

  // Zonder vestiging valt een LOCATION-scope leeg (fail-closed).
  assert.deepEqual(activitiesForScope("LOCATION", ORG_A, activities), []);
});

test("spec (d): ORGANIZATION en GLOBAL tellen over álle vestigingen van de organisatie", () => {
  for (const scope of ["ORGANIZATION", "GLOBAL"] as const) {
    const set = activitiesForScope(scope, ORG_A, activities);
    assert.deepEqual(set.map((a) => a.id), ["s1", "s2", "s3"]);
  }
});

test("spec (d): geen enkele scope telt rijen van een andere organisatie mee", () => {
  for (const scope of ["LOCATION", "ORGANIZATION", "GLOBAL"] as const) {
    const set = activitiesForScope(scope, ORG_A, activities, CENTRUM);
    assert.ok(set.every((a) => a.tenantId === ORG_A));
    assert.ok(!set.some((a) => a.id.startsWith("x")));
  }
  // Ook andersom: organisatie B ziet alleen de eigen rijen.
  const orgB = activitiesForScope("ORGANIZATION", ORG_B, activities);
  assert.deepEqual(orgB.map((a) => a.id), ["x1", "x2"]);
});

test("locationScopeKey: '' voor org/global (eenmalig per lidmaatschap), vestiging-id voor LOCATION", () => {
  assert.equal(locationScopeKeyFor("ORGANIZATION"), "");
  assert.equal(locationScopeKeyFor("GLOBAL"), "");
  assert.equal(locationScopeKeyFor("GLOBAL", CENTRUM), ""); // locatie is irrelevant
  assert.equal(locationScopeKeyFor("LOCATION", CENTRUM), CENTRUM);
  assert.equal(locationScopeKeyFor("LOCATION", ZUID), ZUID);
  // Per vestiging een eigen scope-eenheid → per vestiging opnieuw behaalbaar.
  assert.notEqual(locationScopeKeyFor("LOCATION", CENTRUM), locationScopeKeyFor("LOCATION", ZUID));
});
