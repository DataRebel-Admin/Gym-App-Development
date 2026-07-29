// Tests voor de whitelist-sanering van meldingscontext (probleem melden aan de
// developers). Geen testframework-dependency: Node's ingebouwde `node:test`
// via tsx. Acceptatiecriterium: geen enkele melding bevat een token, cookie of
// Authorization-header — expliciet getest.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeReportContext,
  scrubSecrets,
  formatReportRef,
  MAX_CLIENT_ERRORS,
  REPORT_CONTEXT_KEYS,
} from "../lib/report-context";

test("onbekende sleutels (token, cookie, headers, body) worden verwijderd", () => {
  const result = sanitizeReportContext({
    route: "/member/schema",
    token: "geheim-token-123",
    cookie: "gymrebel-auth-tenant=fitpower; sessie=abc",
    authorization: "Bearer abc.def.ghi",
    headers: { Authorization: "Bearer xyz" },
    body: { password: "hunter2" },
    localStorageDump: "van alles",
  });

  assert.deepEqual(Object.keys(result), ["route"]);
  assert.equal(result.route, "/member/schema");
  const json = JSON.stringify(result);
  assert.ok(!json.includes("geheim-token-123"));
  assert.ok(!json.includes("hunter2"));
  assert.ok(!json.toLowerCase().includes("bearer"));
  assert.ok(!json.toLowerCase().includes("cookie"));
});

test("melding bevat nooit een Bearer-token, cookie of JWT — ook niet in vrije tekst", () => {
  const result = sanitizeReportContext({
    route: "/owner?access_token=supergeheim123",
    userAgent: "Mozilla/5.0 Authorization: Bearer aaaa.bbbb.cccc",
    clientErrors: [
      {
        message: "fetch faalde met Bearer sk-live-abcdef123456",
        stack:
          "Error: 401\n  at fetch (/app.js:1)\n  Cookie: sessie=zeer-geheim\n  " +
          "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N",
      },
    ],
  });

  const json = JSON.stringify(result);
  assert.ok(!/bearer\s+[a-z0-9]/i.test(json), "geen Bearer-token");
  assert.ok(!json.includes("supergeheim123"), "geen access_token-waarde");
  assert.ok(!json.includes("zeer-geheim"), "geen cookie-waarde");
  assert.ok(!json.includes("eyJhbGciOiJIUzI1NiJ9"), "geen JWT");
  // De onschuldige delen blijven bruikbaar voor debugging.
  assert.ok(result.clientErrors?.[0]?.message.includes("fetch faalde"));
});

test("clientErrors worden afgekapt op het maximum en gesaneerd", () => {
  const errors = Array.from({ length: 12 }, (_, i) => ({
    message: `fout ${i}`,
    extraVeld: "mag niet mee",
  }));
  const result = sanitizeReportContext({ clientErrors: errors });

  assert.equal(result.clientErrors?.length, MAX_CLIENT_ERRORS);
  assert.equal(result.clientErrors?.[0]?.message, "fout 0");
  assert.ok(!JSON.stringify(result).includes("mag niet mee"));
});

test("te lange strings worden afgekapt", () => {
  const result = sanitizeReportContext({
    route: "a".repeat(2000),
    clientErrors: [{ message: "x", stack: "s".repeat(9000) }],
  });
  assert.equal(result.route?.length, 500);
  assert.equal(result.clientErrors?.[0]?.stack?.length, 2000);
});

test("niet-object-input geeft een leeg object", () => {
  assert.deepEqual(sanitizeReportContext(null), {});
  assert.deepEqual(sanitizeReportContext("string"), {});
  assert.deepEqual(sanitizeReportContext(42), {});
  assert.deepEqual(sanitizeReportContext([{ route: "/x" }]), {});
  assert.deepEqual(sanitizeReportContext(undefined), {});
});

test("lege en niet-string waarden op whitelisted sleutels vallen weg", () => {
  const result = sanitizeReportContext({
    route: "  ",
    platform: null,
    appVersion: { nested: "object" },
    buildId: 12345, // getal mag — wordt string
  });
  assert.deepEqual(result, { buildId: "12345" });
});

test("scrubSecrets laat gewone tekst intact", () => {
  const text = "TypeError: Cannot read properties of undefined (reading 'naam')";
  assert.equal(scrubSecrets(text), text);
});

test("alle whitelist-sleutels overleven met nette waarden", () => {
  const input: Record<string, string> = {};
  for (const key of REPORT_CONTEXT_KEYS) {
    if (key !== "clientErrors") input[key] = `waarde-${key}`;
  }
  const result = sanitizeReportContext(input);
  for (const key of REPORT_CONTEXT_KEYS) {
    if (key !== "clientErrors") {
      assert.equal(result[key], `waarde-${key}`);
    }
  }
});

test("formatReportRef maakt een kort hoofdletter-referentienummer", () => {
  assert.equal(formatReportRef("cmdl2abc123xyz9k3f9a2c1"), "#K3F9A2C1");
  assert.ok(formatReportRef("abc").startsWith("#"));
});
