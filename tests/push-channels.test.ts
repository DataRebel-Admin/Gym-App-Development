// Tests voor de Android-meldingskanalen. Naast de pure lookup bewaken deze
// tests twee invarianten die over bestandsgrenzen heen lopen en die je anders
// pas op een toestel ontdekt: de koppeling met strings.xml en met de manifest.
// Draaien: `npx tsx --test tests/push-channels.test.ts` (of `npm test`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUSH_CHANNELS,
  ALL_PUSH_CHANNELS,
  DEFAULT_PUSH_CHANNEL,
  channelIdFor,
} from "../lib/push-channels";

const ROOT = join(import.meta.dirname, "..");
const STRINGS_XML = join(ROOT, "android/app/src/main/res/values/strings.xml");
const MANIFEST = join(ROOT, "android/app/src/main/AndroidManifest.xml");

test("channelIdFor geeft het kanaal van een bekende categorie", () => {
  assert.equal(channelIdFor("schemas"), PUSH_CHANNELS.schemas.id);
  assert.equal(channelIdFor("defects"), PUSH_CHANNELS.defects.id);
});

test("channelIdFor geeft null bij een onbekende of ontbrekende categorie", () => {
  // Null → de melding valt terug op het vangnet-kanaal uit de manifest. Een
  // verzonnen kanaal-id zou een melding opleveren die de gebruiker nergens in de
  // systeeminstellingen kan terugvinden.
  assert.equal(channelIdFor(undefined), null);
  assert.equal(channelIdFor(""), null);
  assert.equal(channelIdFor("news"), null);
  assert.equal(channelIdFor("bestaat-niet"), null);
});

test("kanaal-id's zijn uniek", () => {
  const ids = ALL_PUSH_CHANNELS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "dubbele kanaal-id gevonden");
});

test("het vangnet-kanaal zit in de lijst die de app aanmaakt", () => {
  // Anders verwijst de manifest naar een kanaal dat nooit bestaat, en negeert
  // Android de melding op Android 8+ volledig.
  assert.ok(ALL_PUSH_CHANNELS.some((c) => c.id === DEFAULT_PUSH_CHANNEL.id));
});

test("strings.xml gebruikt exact het vangnet-kanaal uit de registry", () => {
  const xml = readFileSync(STRINGS_XML, "utf8");
  const match = xml.match(
    /<string name="default_notification_channel_id">([^<]+)<\/string>/
  );
  assert.ok(match, "default_notification_channel_id ontbreekt in strings.xml");
  assert.equal(
    match[1],
    DEFAULT_PUSH_CHANNEL.id,
    "strings.xml en DEFAULT_PUSH_CHANNEL lopen uit elkaar"
  );
});

test("de manifest verwijst naar die string-resource", () => {
  const xml = readFileSync(MANIFEST, "utf8");
  assert.match(
    xml,
    /com\.google\.firebase\.messaging\.default_notification_channel_id/,
    "meta-data voor het standaardkanaal ontbreekt in AndroidManifest.xml"
  );
  assert.match(
    xml,
    /android:value="@string\/default_notification_channel_id"/,
    "de meta-data wijst niet naar @string/default_notification_channel_id"
  );
});

test("importance blijft binnen het bereik dat Android accepteert", () => {
  for (const channel of ALL_PUSH_CHANNELS) {
    assert.ok(
      channel.importance >= 1 && channel.importance <= 5,
      `${channel.id} heeft een ongeldige importance`
    );
  }
});

test("trofeeën onderbreken niet, apparaatmeldingen wel", () => {
  // De hele reden om kanalen te splitsen: zonder dit onderscheid leert de
  // gebruiker de app negeren. Zie de toelichting in lib/push-channels.ts.
  assert.ok(
    PUSH_CHANNELS.achievements.importance < PUSH_CHANNELS.defects.importance,
    "een behaalde trofee mag nooit even hard binnenkomen als een defect apparaat"
  );
});
