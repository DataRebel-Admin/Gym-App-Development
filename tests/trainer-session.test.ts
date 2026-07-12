// Pure-logica-tests voor de trainer-gedreven trainingsflow (PT draait een workout
// namens een lid). Geen testframework-dependency: Node's `node:test` via tsx.
// Draaien: `npx tsx --test tests/trainer-session.test.ts` (of `npm test`).
//
// De DB-/auth-afhankelijke delen (resolveTrainedMember, workout-session-ops) zijn
// server-only en dus niet puur importeerbaar; we testen de security-kritische
// scoping-predicate (tenant-isolatie) en de provenance-weergave, die beide bewust
// puur zijn gehouden.

import { test } from "node:test";
import assert from "node:assert/strict";
import { trainedMemberWhere } from "../lib/trainer-scope";
import { trainerDisplayName } from "../lib/schema-status";

test("trainedMemberWhere scoopt strikt op de opgegeven tenant + actief lid", () => {
  const where = trainedMemberWhere("member-1", "tenant-A");
  assert.equal(where.id, "member-1");
  assert.equal(where.tenantId, "tenant-A");
  assert.equal(where.role, "TENANT_MEMBER");
  assert.equal(where.active, true);
});

test("trainedMemberWhere gebruikt altijd de meegegeven (trainer-)tenant", () => {
  // De tenant komt uit de trainer-sessie: dezelfde member-id levert per tenant een
  // andere where op → een lookup kan nooit buiten de eigen tenant vallen.
  const inA = trainedMemberWhere("m", "tenant-A");
  const inB = trainedMemberWhere("m", "tenant-B");
  assert.equal(inA.tenantId, "tenant-A");
  assert.equal(inB.tenantId, "tenant-B");
  assert.notEqual(inA.tenantId, inB.tenantId);
});

// Simuleer de Prisma-AND-semantiek om de tenant-isolatie te bewijzen: een lid van
// gym B matcht nooit de scope van een trainer uit gym A.
type UserRow = { id: string; tenantId: string; role: string; active: boolean };
function matchesScope(where: ReturnType<typeof trainedMemberWhere>, u: UserRow): boolean {
  return (
    u.id === where.id &&
    u.tenantId === where.tenantId &&
    u.role === where.role &&
    u.active === where.active
  );
}

test("een lid van gym B valt buiten de scope van een trainer uit gym A", () => {
  const scopeA = trainedMemberWhere("member-1", "tenant-A");
  const memberInB: UserRow = { id: "member-1", tenantId: "tenant-B", role: "TENANT_MEMBER", active: true };
  const memberInA: UserRow = { id: "member-1", tenantId: "tenant-A", role: "TENANT_MEMBER", active: true };
  assert.equal(matchesScope(scopeA, memberInB), false, "cross-tenant lid mag niet matchen");
  assert.equal(matchesScope(scopeA, memberInA), true, "eigen-tenant lid moet matchen");
});

test("gedeactiveerde of niet-lid-accounts vallen buiten de scope", () => {
  const scope = trainedMemberWhere("u1", "tenant-A");
  const inactive: UserRow = { id: "u1", tenantId: "tenant-A", role: "TENANT_MEMBER", active: false };
  const staff: UserRow = { id: "u1", tenantId: "tenant-A", role: "TENANT_STAFF", active: true };
  assert.equal(matchesScope(scope, inactive), false);
  assert.equal(matchesScope(scope, staff), false);
});

test("trainerDisplayName kiest naam > e-mail > null (provenance)", () => {
  assert.equal(trainerDisplayName({ name: "Coach Jan", email: "jan@gym.nl" }), "Coach Jan");
  assert.equal(trainerDisplayName({ name: "  ", email: "jan@gym.nl" }), "jan@gym.nl");
  assert.equal(trainerDisplayName({ name: null, email: "jan@gym.nl" }), "jan@gym.nl");
  assert.equal(trainerDisplayName(null), null);
  assert.equal(trainerDisplayName(undefined), null);
});
