import test from "node:test";
import assert from "node:assert/strict";
import { resolveTenantSlug } from "../lib/tenant-resolve";
import { DEV_FALLBACK_TENANT } from "../lib/constants";

// De tenant-resolutie draait in de edge-proxy en bepaalt wélke sportschool een
// bezoeker ziet. Een verkeerde slug betekent "tenant niet gevonden" of, erger,
// de data van een ándere sportschool.

const ROOT = "gymrebel-training.com";
const resolve = (host: string | null, param?: string | null, cookie?: string | null) =>
  resolveTenantSlug(host, param, cookie, ROOT);

test("een tenant-subdomein levert de slug", () => {
  assert.equal(resolve("fitpower.gymrebel-training.com"), "fitpower");
  assert.equal(resolve("iron-house.gymrebel-training.com:443"), "iron-house");
  assert.equal(resolve("FitPower.GymRebel-Training.com"), "fitpower");
});

test("het apex-domein is géén tenant", () => {
  // Regressie: de oude regel las `gymrebel-training.com` als slug
  // "gymrebel-training", waardoor het kale domein een niet-bestaande tenant kreeg.
  assert.equal(resolve("gymrebel-training.com"), DEV_FALLBACK_TENANT);
  assert.equal(resolve("www.gymrebel-training.com"), DEV_FALLBACK_TENANT);
  assert.equal(resolve("gymrebel-training.com", "fitpower"), "fitpower");
});

test("de app-host en andere gereserveerde labels zijn geen tenant", () => {
  assert.equal(resolve("app.gymrebel-training.com"), DEV_FALLBACK_TENANT);
  assert.equal(resolve("app.gymrebel-training.com", null, "ironhouse"), "ironhouse");
});

test("op een Vercel-preview-host is het projectlabel geen tenant", () => {
  assert.equal(resolve("gym-app-data-rebel-s-projects.vercel.app"), DEV_FALLBACK_TENANT);
  assert.equal(resolve("gym-app-data-rebel-s-projects.vercel.app", "fitpower"), "fitpower");
});

test("development blijft werken: *.localhost en ?tenant", () => {
  assert.equal(resolve("fitpower.localhost:3001"), "fitpower");
  assert.equal(resolve("localhost:3001"), DEV_FALLBACK_TENANT);
  assert.equal(resolve("localhost:3001", "ironhouse"), "ironhouse");
});

test("volgorde zonder host-treffer: ?tenant → cookie → fallback", () => {
  assert.equal(resolve(null, "fitpower", "ironhouse"), "fitpower");
  assert.equal(resolve(null, null, "ironhouse"), "ironhouse");
  assert.equal(resolve(null), DEV_FALLBACK_TENANT);
});
