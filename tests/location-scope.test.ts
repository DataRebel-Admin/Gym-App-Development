// Pure-logica-tests voor de locatie-scope (lib/location-scope.ts) — de
// security-kritische restrictie "een vestigingsmanager ziet uitsluitend de
// gekoppelde vestigingen, nooit een zusterorganisatie". Geen testframework-
// dependency: Node's `node:test` via tsx. Draaien:
// `npx tsx --test tests/location-scope.test.ts` (of `npm test`).
//
// De DB-afhankelijke laag (getLocationScope in lib/location-access.ts) is
// server-only; hier testen we de pure predicaten die die laag autoritatief
// toepast — inclusief een handmatige simulatie van Prisma's where-semantiek
// (patroon tests/trainer-session.test.ts). Dit dekt spec-scenario's (b) en (c).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accessibleLocations,
  locationScopeWhere,
  sessionLocationWhere,
  canRollUp,
  canAccessLocation,
  assertLocationAccess,
  scopeCacheKey,
  scopeLocationIds,
  type LocationScope,
} from "../lib/location-scope";
import { ForbiddenError } from "../lib/rbac";

// Handmatige simulatie van Prisma's AND-semantiek voor het where-fragment.
type ActivityRow = { tenantId: string; locationId: string };
function matches(row: ActivityRow, where: { tenantId: string; locationId?: { in: string[] } }) {
  if (row.tenantId !== where.tenantId) return false;
  if (where.locationId && !where.locationId.in.includes(row.locationId)) return false;
  return true;
}

const ORG_A = "tenant-a";
const ORG_B = "tenant-b";
const LOC_A1 = "a-centrum";
const LOC_A2 = "a-zuid";
const LOC_A3 = "a-noord";
const LOC_B1 = "b-hoofd";

const rows: ActivityRow[] = [
  { tenantId: ORG_A, locationId: LOC_A1 },
  { tenantId: ORG_A, locationId: LOC_A2 },
  { tenantId: ORG_A, locationId: LOC_A3 },
  { tenantId: ORG_B, locationId: LOC_B1 },
  // Kwaadaardige rand: organisatie B hergebruikt (per ongeluk of expres) een
  // locatie-id dat lijkt op dat van A — tenant-filter moet dit altijd afvangen.
  { tenantId: ORG_B, locationId: LOC_A1 },
];

test("admin krijgt org-scope, medewerker uitsluitend de gekoppelde vestigingen (restrictie, geen lens)", () => {
  assert.deepEqual(accessibleLocations({ role: "TENANT_ADMIN" }, [LOC_A1, LOC_A2], []), {
    kind: "org",
  });
  assert.deepEqual(accessibleLocations({ role: "SUPERADMIN" }, [LOC_A1], []), { kind: "org" });

  const staff = accessibleLocations({ role: "TENANT_STAFF" }, [LOC_A1, LOC_A2, LOC_A3], [
    { locationId: LOC_A1 },
  ]);
  assert.deepEqual(staff, { kind: "locations", ids: [LOC_A1] });

  // Koppeling naar een vreemde/gearchiveerde vestiging (niet in de actieve set) telt niet.
  const stale = accessibleLocations({ role: "TENANT_STAFF" }, [LOC_A1], [
    { locationId: LOC_A1 },
    { locationId: LOC_B1 },
  ]);
  assert.deepEqual(stale, { kind: "locations", ids: [LOC_A1] });

  // Leden krijgen nooit een analytics-scope.
  assert.deepEqual(accessibleLocations({ role: "TENANT_MEMBER" }, [LOC_A1], [{ locationId: LOC_A1 }]), {
    kind: "locations",
    ids: [],
  });
});

test("spec (b): vestigingsmanager kan geen zustervestiging bevragen — ook niet via een geaggregeerd endpoint", () => {
  const manager: LocationScope = accessibleLocations(
    { role: "TENANT_STAFF" },
    [LOC_A1, LOC_A2, LOC_A3],
    [{ locationId: LOC_A1 }, { locationId: LOC_A2 }] // beheert 2 van de 3
  );

  // Rij-niveau: rijen van de zustervestiging (A3) matchen nooit.
  const where = locationScopeWhere(ORG_A, manager);
  const visible = rows.filter((r) => matches(r, where));
  assert.deepEqual(
    visible.map((r) => r.locationId).sort(),
    [LOC_A1, LOC_A2].sort()
  );
  assert.ok(!visible.some((r) => r.locationId === LOC_A3));

  // Directe toegang tot de zustervestiging wordt geweigerd.
  assert.equal(canAccessLocation(manager, LOC_A3), false);
  assert.throws(() => assertLocationAccess(manager, LOC_A3), ForbiddenError);

  // Geaggregeerd endpoint: geen org-rollup voor een gescopede manager, en de
  // iteratieset bevat de zustervestiging niet.
  assert.equal(canRollUp(manager), false);
  assert.deepEqual(scopeLocationIds(manager, [LOC_A1, LOC_A2, LOC_A3]).sort(), [LOC_A1, LOC_A2].sort());

  // Fail-closed: een medewerker zónder koppelingen ziet nul rijen.
  const none = accessibleLocations({ role: "TENANT_STAFF" }, [LOC_A1, LOC_A2, LOC_A3], []);
  assert.equal(rows.filter((r) => matches(r, locationScopeWhere(ORG_A, none))).length, 0);
});

test("spec (c): organisatie A ziet niets van organisatie B — ook niet bij botsende locatie-ids", () => {
  // Zelfs de ruimste scope (org) draagt altijd het tenant-filter.
  const orgScope: LocationScope = { kind: "org" };
  const visible = rows.filter((r) => matches(r, locationScopeWhere(ORG_A, orgScope)));
  assert.ok(visible.every((r) => r.tenantId === ORG_A));
  assert.ok(!visible.some((r) => r.tenantId === ORG_B));

  // Ook met een expliciete (gestolen) locatie-id van B blijft tenant A leeg op B-rijen.
  const stolen = locationScopeWhere(ORG_A, { kind: "locations", ids: [LOC_B1, LOC_A1] });
  const stolenVisible = rows.filter((r) => matches(r, stolen));
  assert.ok(stolenVisible.every((r) => r.tenantId === ORG_A));

  // De sessie-variant draagt hetzelfde tenant-filter.
  const viaSession = sessionLocationWhere(ORG_A, { kind: "locations", ids: [LOC_A1] });
  assert.equal(viaSession.tenantId, ORG_A);
  assert.deepEqual(viaSession.session, { locationId: { in: [LOC_A1] } });
});

test("scopeCacheKey is stabiel per set en onderscheidt org van gescopede varianten", () => {
  assert.equal(scopeCacheKey({ kind: "org" }), "org");
  assert.equal(
    scopeCacheKey({ kind: "locations", ids: [LOC_A2, LOC_A1] }),
    scopeCacheKey({ kind: "locations", ids: [LOC_A1, LOC_A2] })
  );
  assert.notEqual(scopeCacheKey({ kind: "org" }), scopeCacheKey({ kind: "locations", ids: [LOC_A1] }));
  assert.notEqual(
    scopeCacheKey({ kind: "locations", ids: [LOC_A1] }),
    scopeCacheKey({ kind: "locations", ids: [LOC_A2] })
  );
});
