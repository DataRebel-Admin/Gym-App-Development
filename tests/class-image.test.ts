// Pure-logica-test voor de beeldresolver van een lestype (lib/class-image.ts).
// Draaien: `npx tsx --test tests/class-image.test.ts` (of `npm test`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { classImage } from "../lib/class-image";

test("eigen foto wint van het logo en krijgt de lesnaam als alt-tekst", () => {
  const img = classImage(
    { name: "Spinning", imageUrl: "https://blob/spin.webp" },
    { logoUrl: "https://blob/logo.png" }
  );
  assert.deepEqual(img, { url: "https://blob/spin.webp", kind: "photo", alt: "Spinning" });
});

test("zonder eigen foto valt het terug op het sportschoollogo, zonder alt-tekst", () => {
  const img = classImage({ name: "Yoga", imageUrl: null }, { logoUrl: "https://blob/logo.png" });
  assert.deepEqual(img, { url: "https://blob/logo.png", kind: "logo", alt: "" });
});

test("zonder foto én zonder logo is er geen beeld (de UI toont een accent-vlak)", () => {
  assert.equal(classImage({ name: "Yoga", imageUrl: null }), null);
  assert.equal(classImage({ name: "Yoga", imageUrl: null }, { logoUrl: null }), null);
});
