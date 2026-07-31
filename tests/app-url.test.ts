import test from "node:test";
import assert from "node:assert/strict";
import { appBaseUrl, toAbsoluteUrl } from "../lib/app-url";

// Deze helper bestaat voor alles wat de app verlaat: e-mail, PDF, QR-labels.
// Daar bestaat "/brand/logo.png" niet, dus een relatief pad moet een origin krijgen.

const KEYS = ["APP_BASE_URL", "AUTH_URL", "NEXTAUTH_URL"] as const;
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>, fn: () => void) {
  for (const key of KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    fn();
  } finally {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

test("APP_BASE_URL wint, daarna AUTH_URL, daarna NEXTAUTH_URL, daarna de default", () => {
  // APP_BASE_URL staat vóór AUTH_URL zodat AUTH_URL leeg kan blijven: die
  // herschrijft namelijk de origin van elke request (next-auth reqWithEnvURL)
  // en botst daarmee met tenant-subdomeinen.
  withEnv({ APP_BASE_URL: "https://z.example", AUTH_URL: "https://a.example" }, () => {
    assert.equal(appBaseUrl(), "https://z.example");
  });
  withEnv({ AUTH_URL: "https://a.example", NEXTAUTH_URL: "https://b.example" }, () => {
    assert.equal(appBaseUrl(), "https://a.example");
  });
  withEnv({ NEXTAUTH_URL: "https://b.example" }, () => {
    assert.equal(appBaseUrl(), "https://b.example");
  });
  withEnv({}, () => {
    assert.equal(appBaseUrl(), "https://app.gymrebel-training.com");
  });
});

test("afsluitende slashes verdwijnen, zodat er nooit een dubbele // ontstaat", () => {
  withEnv({ APP_BASE_URL: "https://a.example///" }, () => {
    assert.equal(appBaseUrl(), "https://a.example");
    assert.equal(toAbsoluteUrl("/brand/logo.png"), "https://a.example/brand/logo.png");
  });
});

test("een relatief pad krijgt de app-origin, met of zonder leidende slash", () => {
  withEnv({ APP_BASE_URL: "https://app.test" }, () => {
    assert.equal(toAbsoluteUrl("/brand/logo.png"), "https://app.test/brand/logo.png");
    assert.equal(toAbsoluteUrl("brand/logo.png"), "https://app.test/brand/logo.png");
  });
});

test("een al absolute URL blijft ongemoeid (tenant-logo op Blob)", () => {
  withEnv({ APP_BASE_URL: "https://app.test" }, () => {
    const blob = "https://xyz.public.blob.vercel-storage.com/logo-abc.png";
    assert.equal(toAbsoluteUrl(blob), blob);
    assert.equal(toAbsoluteUrl("http://localhost:3001/x.png"), "http://localhost:3001/x.png");
    assert.equal(toAbsoluteUrl("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  });
});

test("leeg blijft leeg — de aanroeper valt dan terug op het tekst-wordmerk", () => {
  assert.equal(toAbsoluteUrl(null), null);
  assert.equal(toAbsoluteUrl(undefined), null);
  assert.equal(toAbsoluteUrl("   "), null);
});
