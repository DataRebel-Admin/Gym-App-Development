import test from "node:test";
import assert from "node:assert/strict";
import { appBaseUrl, toAbsoluteUrl } from "../lib/app-url";

// Deze helper bestaat voor alles wat de app verlaat: e-mail, PDF, QR-labels.
// Daar bestaat "/brand/logo.png" niet, dus een relatief pad moet een origin krijgen.

const original = { auth: process.env.AUTH_URL, next: process.env.NEXTAUTH_URL };

function withEnv(auth: string | undefined, next: string | undefined, fn: () => void) {
  if (auth === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = auth;
  if (next === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = next;
  try {
    fn();
  } finally {
    if (original.auth === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = original.auth;
    if (original.next === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = original.next;
  }
}

test("AUTH_URL wint, daarna NEXTAUTH_URL, daarna de productie-default", () => {
  withEnv("https://a.example", "https://b.example", () => {
    assert.equal(appBaseUrl(), "https://a.example");
  });
  withEnv(undefined, "https://b.example", () => {
    assert.equal(appBaseUrl(), "https://b.example");
  });
  withEnv(undefined, undefined, () => {
    assert.equal(appBaseUrl(), "https://app.gymrebel.app");
  });
});

test("afsluitende slashes verdwijnen, zodat er nooit een dubbele // ontstaat", () => {
  withEnv("https://a.example///", undefined, () => {
    assert.equal(appBaseUrl(), "https://a.example");
    assert.equal(toAbsoluteUrl("/brand/logo.png"), "https://a.example/brand/logo.png");
  });
});

test("een relatief pad krijgt de app-origin, met of zonder leidende slash", () => {
  withEnv("https://app.test", undefined, () => {
    assert.equal(toAbsoluteUrl("/brand/logo.png"), "https://app.test/brand/logo.png");
    assert.equal(toAbsoluteUrl("brand/logo.png"), "https://app.test/brand/logo.png");
  });
});

test("een al absolute URL blijft ongemoeid (tenant-logo op Blob)", () => {
  withEnv("https://app.test", undefined, () => {
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
