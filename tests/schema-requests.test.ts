import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REQUEST_KIND_META,
  canCancelRequest,
  canDeleteRequest,
  canSubmitRequest,
  isOpenRequest,
  parseRequestKind,
  requestKindHref,
} from "../lib/schema-requests";

/**
 * Aanvraagtype: "aanpassing vragen" is iets anders dan "nieuw trainingsschema
 * aanvragen". Deze pure regels worden gedeeld door de member-pagina (welk
 * formulier + kan ik indienen), de server-action (autoritatief) en de coach-queue
 * (badge) — ze mogen dus niet uit elkaar lopen.
 */

test("beide typen hebben een eigen label en badge-kleur", () => {
  for (const kind of ["NEW_SCHEMA", "CHANGE"] as const) {
    assert.ok(REQUEST_KIND_META[kind].label.length > 0, kind);
  }
  assert.notEqual(
    REQUEST_KIND_META.NEW_SCHEMA.tone,
    REQUEST_KIND_META.CHANGE.tone,
    "de coach moet de twee typen in de queue kunnen onderscheiden"
  );
});

test("?type= wordt naar het juiste type gelezen, met nieuw schema als vangnet", () => {
  assert.equal(parseRequestKind("aanpassing"), "CHANGE");
  assert.equal(parseRequestKind("CHANGE"), "CHANGE");
  assert.equal(parseRequestKind("Aanpassing"), "CHANGE");
  assert.equal(parseRequestKind(undefined), "NEW_SCHEMA");
  assert.equal(parseRequestKind(""), "NEW_SCHEMA");
  assert.equal(parseRequestKind("onzin"), "NEW_SCHEMA");
  // Next levert bij een dubbele parameter een array — dan telt de eerste.
  assert.equal(parseRequestKind(["aanpassing", "x"]), "CHANGE");
});

test("de link van een type leest terug als datzelfde type (rondgang)", () => {
  for (const kind of ["NEW_SCHEMA", "CHANGE"] as const) {
    const href = requestKindHref(kind);
    const param = href.includes("?") ? href.split("type=")[1] : undefined;
    assert.equal(parseRequestKind(param), kind, href);
  }
});

test("een aanpassing wordt niet geblokkeerd door een lopende nieuw-schema-aanvraag", () => {
  assert.equal(canSubmitRequest("CHANGE", ["NEW_SCHEMA"]), true);
  assert.equal(canSubmitRequest("NEW_SCHEMA", ["CHANGE"]), true);
});

test("twee keer hetzelfde type openzetten blijft geblokkeerd", () => {
  assert.equal(canSubmitRequest("CHANGE", ["CHANGE"]), false);
  assert.equal(canSubmitRequest("NEW_SCHEMA", ["NEW_SCHEMA"]), false);
  assert.equal(canSubmitRequest("CHANGE", ["NEW_SCHEMA", "CHANGE"]), false);
});

test("zonder openstaande aanvragen mag alles", () => {
  assert.equal(canSubmitRequest("NEW_SCHEMA", []), true);
  assert.equal(canSubmitRequest("CHANGE", []), true);
});

/**
 * Intrekken vs. verwijderen — het lid moet z'n eigen aanvraag altijd kwijt
 * kunnen, zonder dat de coach historie verliest. Dezelfde predicaten bepalen
 * wélke knop de pagina toont én wat de server-action toestaat.
 */

const ALL_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "SCHEMA_CREATED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;

test("intrekken kan in élke open status — ook SCHEMA_CREATED", () => {
  for (const s of ALL_STATUSES) {
    assert.equal(canCancelRequest(s), isOpenRequest(s), `${s}: intrekbaar == open`);
  }
  // Zonder dit zit een lid vast: SCHEMA_CREATED telt als open en blokkeert via
  // canSubmitRequest elke nieuwe aanvraag van hetzelfde type.
  assert.equal(canCancelRequest("SCHEMA_CREATED"), true);
});

test("verwijderen mag alleen bij afgesloten aanvragen die nergens toe leidden", () => {
  assert.equal(canDeleteRequest("CANCELLED"), true);
  assert.equal(canDeleteRequest("REJECTED"), true);
  // COMPLETED draagt de koppeling naar het opgeleverde schema → historie blijft.
  assert.equal(canDeleteRequest("COMPLETED"), false);
});

test("een open aanvraag verwijder je nooit direct — die trek je eerst in", () => {
  for (const s of ALL_STATUSES.filter(isOpenRequest)) {
    assert.equal(canDeleteRequest(s), false, s);
  }
});

test("intrekken en verwijderen sluiten elkaar uit (nooit twee knoppen)", () => {
  for (const s of ALL_STATUSES) {
    assert.equal(
      canCancelRequest(s) && canDeleteRequest(s),
      false,
      `${s} mag niet tegelijk intrekbaar en verwijderbaar zijn`
    );
  }
});
