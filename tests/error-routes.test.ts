// Tests voor de routesuggesties op de foutpagina's. Pure logica, dus geen
// framework-dependency: Node's `node:test` via tsx.
// Draaien: `npx tsx --test tests/error-routes.test.ts` (of `npm test`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { routesForRole, suggestRoutes, KNOWN_ROUTES } from "../lib/errors";

test("een lid ziet lid-routes en publieke routes, geen owner-routes", () => {
  const hrefs = routesForRole("TENANT_MEMBER").map((r) => r.href);
  assert.ok(hrefs.includes("/member/schema"));
  assert.ok(hrefs.includes("/login"));
  assert.ok(!hrefs.includes("/owner/members"));
});

test("zonder rol blijven alleen de publieke routes over", () => {
  const hrefs = routesForRole(null).map((r) => r.href);
  assert.deepEqual(hrefs.sort(), ["/", "/account", "/login"].sort());
});

test("een uitgeschakelde functie verdwijnt uit de suggesties", () => {
  // De aanleiding: bij een sportschool zónder groepslessen stelde de 404-pagina
  // "Rooster" voor, en die pagina geeft daar zelf ook een 404.
  const met = routesForRole("TENANT_MEMBER").map((r) => r.href);
  const zonder = routesForRole("TENANT_MEMBER", ["group_classes"]).map((r) => r.href);

  assert.ok(met.includes("/member/rooster"), "rooster hoort er te staan als lessen aan staan");
  assert.ok(!zonder.includes("/member/rooster"), "rooster hoort weg te vallen als lessen uit staan");
  assert.equal(zonder.length, met.length - 1, "alleen die ene route mag verdwijnen");
});

test("hetzelfde geldt aan de ownerkant", () => {
  const zonder = routesForRole("TENANT_ADMIN", ["group_classes"]).map((r) => r.href);
  assert.ok(!zonder.includes("/owner/rooster"));
  assert.ok(zonder.includes("/owner/members"), "de rest blijft ongemoeid");
});

test("weglaten van de lijst filtert niets weg", () => {
  // Bewust: kunnen we de status niet ophalen, dan is één suggestie te veel
  // beter dan een lege lijst.
  assert.equal(
    routesForRole("TENANT_MEMBER").length,
    routesForRole("TENANT_MEMBER", []).length
  );
});

test("suggestRoutes stelt een uitgeschakelde route niet voor bij een typo", () => {
  const raak = suggestRoutes("/member/roosterr", "TENANT_MEMBER");
  assert.equal(raak[0]?.route.href, "/member/rooster", "zonder filter is dit de beste match");

  const gefilterd = suggestRoutes("/member/roosterr", "TENANT_MEMBER", 4, ["group_classes"]);
  assert.ok(
    gefilterd.every((s) => s.route.href !== "/member/rooster"),
    "met lessen uit mag hij niet meer voorgesteld worden"
  );
});

test("elke route met een functie-afhankelijkheid gebruikt een bekende sleutel", () => {
  // Vangnet: een typefout in `feature` zou de route stil altijd tonen.
  const bekend = new Set(["group_classes"]);
  for (const r of KNOWN_ROUTES) {
    if (r.feature) assert.ok(bekend.has(r.feature), `onbekende feature op ${r.href}`);
  }
});
