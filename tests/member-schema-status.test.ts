import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isEditableMemberStatus,
  isWithdrawableMemberStatus,
  isCommittedMemberStatus,
  statusAfterWithdraw,
  hasUnsubmittedChanges,
  requiresApproval,
} from "../lib/member-schema-status";

/**
 * Levenscyclus van zelf-gebouwde lid-schema's: het lid houdt eigenaarschap en mag
 * altijd bewerken, behálve zolang de coach beoordeelt. Deze regels zijn puur en
 * worden gedeeld door de guard (pagina), de server-action en de UI-labels — ze
 * moeten dus niet uit elkaar lopen.
 */

test("bewerken mag in elke status behalve tijdens de beoordeling", () => {
  for (const s of ["DRAFT", "REJECTED", "APPROVED", "ACTIVE", "PAUSED"] as const) {
    assert.equal(isEditableMemberStatus(s), true, s);
  }
  assert.equal(isEditableMemberStatus("IN_REVIEW"), false);
});

test("intrekken kan precies dán als bewerken niet kan (geen dood spoor)", () => {
  for (const s of ["DRAFT", "IN_REVIEW", "REJECTED", "APPROVED", "ACTIVE", "PAUSED"] as const) {
    assert.equal(
      isEditableMemberStatus(s) !== isWithdrawableMemberStatus(s),
      true,
      `${s} moet óf bewerkbaar óf intrekbaar zijn`
    );
  }
});

test("vastgelegd = goedgekeurd/actief/gepauzeerd", () => {
  assert.equal(isCommittedMemberStatus("APPROVED"), true);
  assert.equal(isCommittedMemberStatus("ACTIVE"), true);
  assert.equal(isCommittedMemberStatus("PAUSED"), true);
  assert.equal(isCommittedMemberStatus("DRAFT"), false);
  assert.equal(isCommittedMemberStatus("REJECTED"), false);
  assert.equal(isCommittedMemberStatus("IN_REVIEW"), false);
});

test("intrekken keert terug naar de staat van vóór het indienen", () => {
  // Lopend schema blijft lopen — intrekken mag nooit iemands training afpakken.
  assert.equal(statusAfterWithdraw("PUBLISHED"), "ACTIVE");
  assert.equal(statusAfterWithdraw("ARCHIVED"), "PAUSED");
  assert.equal(statusAfterWithdraw("DRAFT"), "DRAFT");
});

test("niet-ingediende wijziging = inhoud jonger dan de laatste beoordeling", () => {
  const reviewedAt = new Date("2026-07-01T10:00:00Z");
  const later = new Date("2026-07-02T10:00:00Z");
  const earlier = new Date("2026-06-30T10:00:00Z");

  assert.equal(
    hasUnsubmittedChanges({
      status: "ACTIVE",
      needsApproval: true,
      contentUpdatedAt: later,
      reviewedAt,
    }),
    true
  );
  assert.equal(
    hasUnsubmittedChanges({
      status: "ACTIVE",
      needsApproval: true,
      contentUpdatedAt: earlier,
      reviewedAt,
    }),
    false
  );
  // Zonder goedkeuringsplicht valt er niets in te dienen.
  assert.equal(
    hasUnsubmittedChanges({
      status: "ACTIVE",
      needsApproval: false,
      contentUpdatedAt: later,
      reviewedAt,
    }),
    false
  );
  // Concept is nog nooit vastgelegd → geen "vergeten in te dienen"-ruis.
  assert.equal(
    hasUnsubmittedChanges({
      status: "DRAFT",
      needsApproval: true,
      contentUpdatedAt: later,
      reviewedAt,
    }),
    false
  );
  // Nooit beoordeeld (bv. DIRECT-modus) → geen nullijn, dus geen melding.
  assert.equal(
    hasUnsubmittedChanges({
      status: "ACTIVE",
      needsApproval: true,
      contentUpdatedAt: later,
      reviewedAt: null,
    }),
    false
  );
});

test("kader-override bepaalt of een bewerking opnieuw beoordeeld wordt", () => {
  assert.equal(requiresApproval("DIRECT", null), false);
  assert.equal(requiresApproval("DIRECT", true), true);
  assert.equal(requiresApproval("APPROVAL", null), true);
  assert.equal(requiresApproval("APPROVAL", false), false);
});
