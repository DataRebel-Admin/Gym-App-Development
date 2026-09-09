import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTrainableSchema,
  canMakeActive,
  switchState,
  type SwitchRow,
} from "../lib/schema-switch";

/**
 * Schema's afwisselen: welke toewijzingen mag een lid actief maken of eenmalig
 * trainen? Dezelfde regels sturen de wisselpagina en de server-actions.
 */

const now = new Date("2026-09-09T12:00:00Z");

function row(patch: Partial<SwitchRow>): SwitchRow {
  return {
    origin: "COACH",
    status: "PUBLISHED",
    memberStatus: null,
    availableFrom: null,
    endDate: null,
    hasTemplate: true,
    ...patch,
  };
}

test("coach-schema: gepubliceerd én gearchiveerd zijn trainbaar en wisselbaar", () => {
  assert.equal(canMakeActive(row({ status: "PUBLISHED" }), now), true);
  assert.equal(canMakeActive(row({ status: "ARCHIVED" }), now), true);
  assert.equal(isTrainableSchema(row({ status: "ARCHIVED" }), now), true);
});

test("coach-schema: concept en gepland blijven verborgen", () => {
  assert.equal(isTrainableSchema(row({ status: "DRAFT" }), now), false);
  assert.equal(isTrainableSchema(row({ status: "SCHEDULED" }), now), false);
});

test("verlopen of nog niet vrijgegeven telt niet mee", () => {
  assert.equal(
    isTrainableSchema(row({ endDate: new Date("2026-09-01T00:00:00Z") }), now),
    false
  );
  assert.equal(
    isTrainableSchema(row({ availableFrom: new Date("2026-10-01T00:00:00Z") }), now),
    false
  );
  assert.equal(
    isTrainableSchema(row({ endDate: new Date("2026-12-01T00:00:00Z") }), now),
    true
  );
});

test("zonder inhoud valt er niets te trainen", () => {
  assert.equal(isTrainableSchema(row({ hasTemplate: false }), now), false);
});

test("eigen schema: vastgelegd = trainbaar; concept/geweigerd niet", () => {
  for (const s of ["ACTIVE", "PAUSED", "APPROVED", "IN_REVIEW"] as const) {
    assert.equal(
      isTrainableSchema(row({ origin: "MEMBER", status: "DRAFT", memberStatus: s }), now),
      true,
      s
    );
  }
  for (const s of ["DRAFT", "REJECTED"] as const) {
    assert.equal(
      isTrainableSchema(row({ origin: "MEMBER", status: "DRAFT", memberStatus: s }), now),
      false,
      s
    );
  }
});

test("eigen schema in beoordeling: wel trainen, niet actief maken (omzeilt de coach)", () => {
  const r = row({ origin: "MEMBER", status: "PUBLISHED", memberStatus: "IN_REVIEW" });
  assert.equal(isTrainableSchema(r, now), true);
  assert.equal(canMakeActive(r, now), false);
  assert.equal(switchState(r, false), "review");
});

test("toestandslabel volgt herkomst en status", () => {
  assert.equal(switchState(row({}), true), "active");
  assert.equal(switchState(row({ status: "ARCHIVED" }), false), "previous");
  assert.equal(
    switchState(row({ origin: "MEMBER", status: "ARCHIVED", memberStatus: "PAUSED" }), false),
    "paused"
  );
  assert.equal(
    switchState(row({ origin: "MEMBER", status: "DRAFT", memberStatus: "APPROVED" }), false),
    "approved"
  );
});
