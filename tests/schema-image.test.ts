import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIBRARY_TEMPLATE_PHOTOS,
  libraryTemplatePhoto,
  libraryTemplateImage,
  libraryTemplatePhotoKey,
  pexelsSourceUrl,
  schemaImage,
  coverUrlForCopy,
} from "../lib/schema-image";

/**
 * Beeld bij een trainingsschema: eigen upload → herkomst-foto (RepDB-
 * voorbeeldschema) → sportschoollogo. De registry en de terugval mogen niet uit
 * elkaar lopen met wat het upload-script daadwerkelijk naar de blob schrijft —
 * daarom is de sleutel/keypad hier vastgelegd.
 */

test("elke registry-foto heeft een sluitende slug, id en alt-tekst", () => {
  for (const [key, photo] of Object.entries(LIBRARY_TEMPLATE_PHOTOS)) {
    assert.equal(photo.slug, key, `${key}: slug moet gelijk zijn aan de sleutel`);
    assert.ok(photo.pexelsId > 0, `${key}: geen Pexels-id`);
    assert.ok(photo.alt.trim().length > 0, `${key}: alt-tekst is verplicht (a11y)`);
    assert.equal(libraryTemplatePhotoKey(key), `images/schema-templates/${key}.webp`);
  }
});

test("geen twee schema's delen dezelfde foto", () => {
  const ids = Object.values(LIBRARY_TEMPLATE_PHOTOS).map((p) => p.pexelsId);
  assert.equal(new Set(ids).size, ids.length, "dubbele Pexels-id in de registry");
});

test("bronvermelding wijst naar de Pexels-fotopagina", () => {
  assert.equal(pexelsSourceUrl(1552106), "https://www.pexels.com/photo/1552106/");
});

test("een onbekende slug valt terug op het doel, niet op niets", () => {
  // Nieuw voorbeeldschema uit een volgende RepDB-bundel: nog geen eigen foto,
  // maar wél een doel → nooit een beeldloze kaart.
  const viaGoal = libraryTemplatePhoto("nieuw-in-de-bundel", "hypertrophy");
  assert.equal(viaGoal?.slug, "ppl-6-day-intermediate");

  // Ook onze eigen doel-woordenschat (lib/training-goals.ts) wordt gedekt.
  assert.equal(libraryTemplatePhoto("onbekend", "muscle")?.slug, "ppl-6-day-intermediate");

  // Zonder slug én zonder bruikbaar doel is er niets — dan pakt de UI het logo.
  assert.equal(libraryTemplatePhoto("onbekend", "iets-onbekends"), null);
  assert.equal(libraryTemplatePhoto(null), null);
});

test("een eigen slug wint van de doel-terugval", () => {
  const photo = libraryTemplatePhoto("core-finisher-10min", "strength");
  assert.equal(photo?.slug, "core-finisher-10min");
});

test("libraryTemplateImage levert een absolute URL met alt-tekst", () => {
  const img = libraryTemplateImage("stronglifts-5x5");
  assert.equal(img?.kind, "photo");
  assert.ok(img?.url.endsWith("/images/schema-templates/stronglifts-5x5.webp"));
  assert.ok(img?.url.startsWith("http"));
  assert.equal(img?.alt, LIBRARY_TEMPLATE_PHOTOS["stronglifts-5x5"].alt);
});

test("eigen upload wint altijd, ook bij een overgenomen voorbeeldschema", () => {
  const img = schemaImage(
    { imageUrl: "https://blob/eigen.webp", libraryTemplateId: "stronglifts-5x5" },
    { logoUrl: "https://blob/logo.png" }
  );
  assert.deepEqual(img, { url: "https://blob/eigen.webp", kind: "photo", alt: "" });
});

test("overgenomen schema erft de foto van zijn voorbeeldschema", () => {
  const img = schemaImage(
    { imageUrl: null, libraryTemplateId: "kettlebell-complex" },
    { logoUrl: "https://blob/logo.png" }
  );
  assert.equal(img?.kind, "photo");
  assert.ok(img?.url.endsWith("/images/schema-templates/kettlebell-complex.webp"));
});

test("eigen schema valt standaard terug op het sportschoollogo", () => {
  const img = schemaImage({ imageUrl: null, goal: "strength" }, { logoUrl: "https://blob/logo.png" });
  assert.deepEqual(img, { url: "https://blob/logo.png", kind: "logo", alt: "" });
});

test("een kopie krijgt de geërfde foto hard meegeschreven", () => {
  // Toewijzen/dupliceren mag `libraryTemplateId` niet meekopiëren (dat is de
  // idempotentie-sleutel van de import), dus moet de URL zelf mee.
  const url = coverUrlForCopy({ imageUrl: null, libraryTemplateId: "upper-lower-4-day" });
  assert.ok(url?.endsWith("/images/schema-templates/upper-lower-4-day.webp"));
});

test("een kopie van een schema met eigen foto behoudt die foto", () => {
  assert.equal(
    coverUrlForCopy({ imageUrl: "https://blob/eigen.webp", libraryTemplateId: "stronglifts-5x5" }),
    "https://blob/eigen.webp"
  );
});

test("een kopie zonder herkomst krijgt niets mee (valt in de UI terug op het logo)", () => {
  assert.equal(coverUrlForCopy({ imageUrl: null, libraryTemplateId: null, goal: null }), null);
  assert.equal(coverUrlForCopy({ imageUrl: "  " }), null);
});

test("zonder logo en zonder herkomst is er geen beeld (UI toont de accent-achtergrond)", () => {
  assert.equal(schemaImage({}, {}), null);
  assert.equal(schemaImage({}, null), null);
  // Lege strings tellen niet als ingesteld.
  assert.equal(schemaImage({ imageUrl: "   " }, { logoUrl: "  " }), null);
});
