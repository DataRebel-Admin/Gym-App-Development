// Tests voor de demo-login-poort. Deze logica bepaalt wie er wachtwoordloos
// naar binnen mag, dus een regressie hier is meteen een beveiligingslek.
// Draaien: `npx tsx --test tests/demo-login.test.ts` (of `npm test`).

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { demoLoginAllowsAccount, demoLoginEnabled } from "../lib/demo-login-policy";

/** Zet de omgeving. NODE_ENV is in de Next-types readonly, vandaar de cast. */
function env(opts: {
  nodeEnv?: string;
  on?: boolean;
  allowProd?: boolean;
  tenants?: string;
}) {
  (process.env as Record<string, string>).NODE_ENV = opts.nodeEnv ?? "development";
  process.env.DEMO_LOGIN = opts.on === false ? "false" : "true";
  process.env.DEMO_LOGIN_ALLOW_PRODUCTION = opts.allowProd ? "true" : "false";
  process.env.DEMO_LOGIN_TENANTS = opts.tenants ?? "";
}

const SUPERADMIN = { role: "SUPERADMIN" as const, tenantSlug: null };
const LID = { role: "TENANT_MEMBER" as const, tenantSlug: "gymrebel" };
const OWNER = { role: "TENANT_ADMIN" as const, tenantSlug: "gymrebel" };

beforeEach(() => env({}));

test("uit is uit: geen enkel account mag erdoor", () => {
  env({ on: false });
  assert.equal(demoLoginEnabled(), false);
  for (const a of [SUPERADMIN, LID, OWNER]) assert.equal(demoLoginAllowsAccount(a), false);
});

test("in development mag elke rol, inclusief de superadmin", () => {
  env({ nodeEnv: "development" });
  for (const a of [SUPERADMIN, LID, OWNER]) assert.equal(demoLoginAllowsAccount(a), true);
});

test("in productie is één schakelaar niet genoeg", () => {
  env({ nodeEnv: "production", allowProd: false, tenants: "gymrebel" });
  assert.equal(demoLoginEnabled(), false);
  assert.equal(demoLoginAllowsAccount(LID), false);
});

test("in productie nooit een superadmin, ook niet met alles aan", () => {
  // De aanleiding: op de publieke inlogpagina stond een knop waarmee iedereen
  // als superadmin naar /admin kon — alle sportscholen, auditlog, e-mailtemplates.
  env({ nodeEnv: "production", allowProd: true, tenants: "gymrebel,ironhouse" });
  assert.equal(demoLoginAllowsAccount(SUPERADMIN), false);
});

test("in productie alleen sportscholen uit de allowlist", () => {
  env({ nodeEnv: "production", allowProd: true, tenants: "gymrebel" });
  assert.equal(demoLoginAllowsAccount(LID), true);
  assert.equal(demoLoginAllowsAccount({ ...LID, tenantSlug: "ironhouse" }), false);
});

test("lege allowlist laat niemand door (fail-closed)", () => {
  // Belangrijk: de lijst komt uit de database, niet uit de seed. Zonder deze
  // regel zou elke nieuw aangesloten, échte sportschool vanzelf in het
  // publieke paneel verschijnen.
  env({ nodeEnv: "production", allowProd: true, tenants: "" });
  for (const a of [LID, OWNER]) assert.equal(demoLoginAllowsAccount(a), false);
});

test("allowlist is ongevoelig voor spaties en hoofdletters", () => {
  env({ nodeEnv: "production", allowProd: true, tenants: " GymRebel , ironhouse " });
  assert.equal(demoLoginAllowsAccount(LID), true);
  assert.equal(demoLoginAllowsAccount({ ...LID, tenantSlug: "IRONHOUSE" }), true);
});

test("een tenantloos account is in productie nooit toegestaan", () => {
  env({ nodeEnv: "production", allowProd: true, tenants: "gymrebel" });
  assert.equal(demoLoginAllowsAccount({ role: "TENANT_MEMBER", tenantSlug: null }), false);
});
