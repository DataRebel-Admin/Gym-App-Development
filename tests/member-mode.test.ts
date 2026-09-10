import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTrainAsMember,
  hasBothModes,
  isTeamRole,
  modeHref,
  parseMode,
  resolveOpenMode,
} from "../lib/member-mode";

/**
 * Lid-modus: een eigenaar/medewerker die óók zelf bij de sportschool sport.
 * Dezelfde pure regels sturen de guard (`requireMember`), het keuzescherm
 * `/start`, de wissel-ingangen in de menu's en de account-secties.
 */

test("teamrollen zijn de beheerrollen — lid en superadmin niet", () => {
  assert.equal(isTeamRole("TENANT_ADMIN"), true);
  assert.equal(isTeamRole("TENANT_STAFF"), true);
  assert.equal(isTeamRole("TENANT_MEMBER"), false);
  assert.equal(isTeamRole("SUPERADMIN"), false);
  assert.equal(isTeamRole(null), false);
});

test("een lid mag altijd trainen, ongeacht de vlag", () => {
  assert.equal(canTrainAsMember("TENANT_MEMBER", false), true);
  assert.equal(canTrainAsMember("TENANT_MEMBER", true), true);
});

test("een teamlid mag alleen trainen mét de lid-modus aan", () => {
  assert.equal(canTrainAsMember("TENANT_ADMIN", false), false);
  assert.equal(canTrainAsMember("TENANT_ADMIN", true), true);
  assert.equal(canTrainAsMember("TENANT_STAFF", false), false);
  assert.equal(canTrainAsMember("TENANT_STAFF", true), true);
});

test("een superadmin sport nergens mee — die transcendeert tenants", () => {
  assert.equal(canTrainAsMember("SUPERADMIN", true), false);
  assert.equal(hasBothModes("SUPERADMIN", true), false);
});

test("alleen een teamlid met de vlag heeft twee werelden", () => {
  assert.equal(hasBothModes("TENANT_ADMIN", true), true);
  assert.equal(hasBothModes("TENANT_ADMIN", false), false);
  // Een gewoon lid heeft niets te kiezen: geen keuzescherm, geen wisselknop.
  assert.equal(hasBothModes("TENANT_MEMBER", true), false);
});

test("zonder dubbele modus is het openen ongewijzigd rol-gestuurd", () => {
  assert.equal(resolveOpenMode("TENANT_MEMBER", false, null), "member");
  assert.equal(resolveOpenMode("TENANT_ADMIN", false, null), "owner");
  assert.equal(resolveOpenMode("TENANT_STAFF", false, null), "owner");
  // Een achtergebleven cookie mag daar niets aan veranderen (bv. nadat de
  // eigenaar de lid-modus weer uitzette).
  assert.equal(resolveOpenMode("TENANT_ADMIN", false, "member"), "owner");
  assert.equal(resolveOpenMode("TENANT_MEMBER", false, "owner"), "member");
});

test("dubbele modus zonder cookie vraagt het keuzescherm", () => {
  assert.equal(resolveOpenMode("TENANT_ADMIN", true, null), "choose");
  assert.equal(resolveOpenMode("TENANT_STAFF", true, undefined), "choose");
  // Een onzinwaarde telt als "nog niet gekozen" i.p.v. een willekeurige wereld.
  assert.equal(resolveOpenMode("TENANT_ADMIN", true, "rubbish"), "choose");
});

test("dubbele modus mét cookie gaat direct naar die wereld", () => {
  assert.equal(resolveOpenMode("TENANT_ADMIN", true, "member"), "member");
  assert.equal(resolveOpenMode("TENANT_ADMIN", true, "owner"), "owner");
});

test("modus → startpad", () => {
  assert.equal(modeHref("member"), "/member");
  assert.equal(modeHref("owner"), "/owner");
  assert.equal(parseMode("member"), "member");
  assert.equal(parseMode(""), null);
  assert.equal(parseMode(null), null);
});
