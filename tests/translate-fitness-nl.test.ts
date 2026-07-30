import { test } from "node:test";
import assert from "node:assert/strict";
import {
  protectTerms,
  applyDutchFixes,
  stripDictionaryMarkup,
  negationPreserved,
  FORCED_TERMS,
} from "../lib/translate/fitness-nl";

// --- protectTerms -----------------------------------------------------------

test("protectTerms omhult een bekende term met dictionary-markup", () => {
  const out = protectTerms("Grip the dumbbell firmly.");
  assert.equal(
    out,
    'Grip the <mstrans:dictionary translation="dumbbell">dumbbell</mstrans:dictionary> firmly.'
  );
});

test("langste term wint: 'posterior deltoids' niet als 'delts' behandelen", () => {
  const out = protectTerms("Targets the posterior deltoids and upper back.");
  assert.match(out, /translation="achterste deltoïden">posterior deltoids</);
  // Geen tweede, geneste markup binnen dezelfde frase.
  assert.equal((out.match(/<mstrans:dictionary/g) ?? []).length, 1);
});

test("compound wint van los woord: 'bent-over row' blijft heel", () => {
  const out = protectTerms("A two-arm bent-over row with a dumbbell.");
  assert.match(out, /translation="bent-over row">bent-over row</);
  assert.equal((out.match(/<mstrans:dictionary/g) ?? []).length, 2); // row-compound + dumbbell
});

test("beginhoofdletter van de bron blijft in de geforceerde term", () => {
  assert.match(protectTerms("Deadlift from the floor."), /translation="Deadlift">Deadlift</);
});

test("geen treffer binnen een groter woord", () => {
  // "repsomething" mag de 'reps'-regel niet triggeren.
  assert.equal(protectTerms("repsomething"), "repsomething");
  assert.equal(protectTerms("pre-lockout"), "pre-lockout");
});

test("markup is verwijderbaar (defensieve opruiming)", () => {
  const wrapped = protectTerms("Hold the kettlebell.");
  assert.equal(stripDictionaryMarkup(wrapped), "Hold the kettlebell.");
});

test("naamsbeleid: apparaat- en oefeningnamen blijven Engels", () => {
  // Alleen anatomische/algemene termen mogen een Nederlandse waarde krijgen;
  // namen van apparaten en oefeningen houden we in het Engels (dat is ook in
  // het Nederlands de gangbare taal in de sportschool).
  const dutchAllowed = new Set([
    "posterior deltoids",
    "anterior deltoids",
    "lateral deltoids",
    "rear delts",
    "front delts",
    "side delts",
    "delts",
    "calves",
    "reps",
    "rep",
    "too hard",
    "ez bar",
    "romanian deadlift",
  ]);
  for (const [en, nl] of Object.entries(FORCED_TERMS)) {
    if (dutchAllowed.has(en)) continue;
    assert.equal(
      nl.toLowerCase(),
      en.toLowerCase(),
      `naam mag niet vertaald worden: "${en}" → "${nl}"`
    );
  }
});

test("FORCED_TERMS bevat termen, geen clausules (die slopen de zinsbouw)", () => {
  // Empirisch: een geforceerde span mét clausule-inhoud ("… the lower back
  // arch") liet de "Do not" wegvallen → betekenis omgeklapt. Termen mogen dus
  // geen lidwoord/voorzetsel/bezittelijk voornaamwoord bevatten.
  const clauseWords = /\s(the|a|an|your|his|her|their|at|through|into|to|not|and|or|with|over)\s/i;
  for (const key of Object.keys(FORCED_TERMS)) {
    assert.ok(!clauseWords.test(` ${key} `), `clausule in FORCED_TERMS: "${key}"`);
  }
});

// --- applyDutchFixes --------------------------------------------------------

test("'the back arches' → hol trekken (MT las het als zelfstandig naamwoord)", () => {
  assert.equal(
    applyDutchFixes("Stop voordat de heupen zakken of de rugbogen komen."),
    "Stop voordat de heupen zakken of de rug hol trekt."
  );
});

test("hinge-als-werkwoord wordt gym-Nederlands", () => {
  assert.equal(
    applyDutchFixes("Scharnieren bij de heupen, duw ze naar achteren."),
    "Kantel vanuit je heupen, duw ze naar achteren."
  );
  assert.equal(applyDutchFixes("Een heupscharnier met een band."), "Een hip hinge met een band.");
});

test("klassieke MT-blunders worden gerepareerd", () => {
  assert.equal(applyDutchFixes("Pak de domoor."), "Pak de dumbbell.");
  assert.equal(applyDutchFixes("Een gebogen rij met halterroei."), "Een bent-over row met barbell row.");
  assert.equal(applyDutchFixes("Doe 10 vertegenwoordigers."), "Doe 10 herhalingen.");
  assert.equal(applyDutchFixes("Zit op de luchtfiets."), "Zit op de air bike.");
  assert.equal(applyDutchFixes("Span de kern aan."), "Span de core aan.");
});

test("'romp' blijft romp — torso is géén core", () => {
  // Regressie: een eerdere glossarium-regel maakte hier ten onrechte "core" van.
  assert.equal(applyDutchFixes("Houd je romp rechtop."), "Houd je romp rechtop.");
});

test("hoofdletter aan het zinsbegin blijft staan", () => {
  // Regressie: "Knell je glutes" werd "knijp je glutes" (kleine letter).
  assert.equal(applyDutchFixes("Knell je glutes."), "Knijp je glutes.");
  assert.equal(applyDutchFixes("Scharnier vanaf de heupen."), "Kantel vanuit je heupen.");
  assert.equal(applyDutchFixes("Krul de stang omhoog."), "Curl de stang omhoog.");
  assert.equal(applyDutchFixes("Het voorste deltaspier."), "De voorste deltoïde.");
  // Midden in de zin blijft het klein.
  assert.equal(applyDutchFixes("Pauzeer en knell je kuiten."), "Pauzeer en knijp je kuiten.");
});

test("bewegingsnamen worden Engels gemaakt (naamsbeleid)", () => {
  assert.equal(
    applyDutchFixes("Een heupscharnierbeweging met dumbbells."),
    "Een hip hinge met dumbbells."
  );
  assert.equal(
    applyDutchFixes("het leren van het heup-scharnier patroon"),
    "Het leren van het hip hinge-patroon"
  );
  assert.equal(applyDutchFixes("De beweging is een scharnier, geen hurk."), "De beweging is een hip hinge, geen squat.");
  assert.equal(applyDutchFixes("Een glutebrug met een band."), "Een glute bridge met een band.");
  assert.equal(applyDutchFixes("Een trui op een platte bank."), "Een pullover op een platte bank.");
  assert.equal(applyDutchFixes("Vergrendel de arm bovenaan de pers."), "Vergrendel de arm bovenaan de press.");
  assert.equal(applyDutchFixes("Een schuine kraak op de vloer."), "Een schuine crunch op de vloer.");
  assert.equal(applyDutchFixes("Terwijl de klokken stijgen."), "Terwijl de kettlebells stijgen.");
  assert.equal(applyDutchFixes("voordat je begint met de ruk"), "Voordat je begint met de jerk");
  assert.equal(applyDutchFixes("de achterste deltawortels"), "De achterste deltoïden");
  assert.equal(applyDutchFixes("de voorste en zijwaartse deltas"), "De voorste en zijwaartse deltoïden");
});

test("squat: 'hurk' in al zijn vormen wordt squat", () => {
  assert.equal(applyDutchFixes("Hurk neer en leg je handen op de grond."), "Zak in een squat en leg je handen op de grond.");
  assert.equal(applyDutchFixes("Ga in een kwart-hurk."), "Ga in een kwart-squat.");
  assert.equal(applyDutchFixes("Ga in een kwart hurk."), "Ga in een kwart-squat.");
  assert.equal(applyDutchFixes("Hurk tot de dijen parallel zijn."), "Zak tot de dijen parallel zijn.");
  assert.equal(applyDutchFixes("terwijl je hurkt"), "Terwijl je zakt");
  assert.equal(applyDutchFixes("Een hurkpositie met dumbbells."), "Een squatpositie met dumbbells.");
  assert.equal(applyDutchFixes("in een diepe hurk"), "In een diepe squat");
});

test("'drive' wordt kracht zetten / duwen, geen autorijden", () => {
  assert.equal(applyDutchFixes("Rijd door de hielen heen."), "Zet kracht door de hielen heen.");
  assert.equal(applyDutchFixes("Drijf door je voorste hiel."), "Zet kracht door je voorste hiel.");
  assert.equal(applyDutchFixes("Drijf de heupen naar voren."), "Duw de heupen naar voren.");
  assert.equal(applyDutchFixes("Drijf je heupen naar voren."), "Duw je heupen naar voren.");
  assert.equal(applyDutchFixes("Rijd met beide armen en benen."), "Zet kracht met beide armen en benen.");
  assert.equal(applyDutchFixes("waarbij de barbell omhoog wordt gedreven"), "Waarbij de barbell omhoog wordt gedrukt");
  assert.equal(
    applyDutchFixes("die een dumbbell van de vloer naar boven drijft"),
    "Die een dumbbell van de vloer naar boven duwt"
  );
  // "drijft" in de betekenis 'drifts' is correct Nederlands en blijft staan.
  assert.equal(
    applyDutchFixes("Als de bal van links naar rechts drijft, mist je kernsteun."),
    "Als de bal van links naar rechts drijft, mist je core-steun."
  );
});

test("'arch' als rug-holling, maar een échte boog blijft een boog", () => {
  assert.equal(
    applyDutchFixes("Houd een lichte boog in je onderrug aan."),
    "Houd een lichte holling in je onderrug aan."
  );
  assert.equal(applyDutchFixes("elke piek of boog laat de greep instorten"), "Elke pike of holling laat de greep instorten");
  // Arc-beweging: NIET aanpassen.
  assert.equal(
    applyDutchFixes("Laat de stang in een boog weer boven je hoofd zakken."),
    "Laat de stang in een boog weer boven je hoofd zakken."
  );
  assert.equal(
    applyDutchFixes("die de lats strekt door een brede boog"),
    "Die de lats strekt door een brede boog"
  );
});

test("fragment begint altijd met een hoofdletter", () => {
  // Regressie: de eerste refix-ronde liet "kantel vanuit je heupen…" achter.
  assert.equal(
    applyDutchFixes("kantel vanuit je heupen, duw ze naar achteren."),
    "Kantel vanuit je heupen, duw ze naar achteren."
  );
  assert.equal(applyDutchFixes("één been per set."), "Één been per set.");
});

test("'hinged' als bijvoeglijk naamwoord wordt voorovergebogen", () => {
  assert.equal(
    applyDutchFixes("Een scharnierende isolatie-oefening met dumbbells."),
    "Een voorovergebogen isolatie-oefening met dumbbells."
  );
  assert.equal(applyDutchFixes("Houd je scharnierhoek stabiel."), "Houd je hip hinge-hoek stabiel.");
});

// --- negationPreserved (veiligheidsvangnet) --------------------------------

test("ontkenning bewaard → true", () => {
  assert.ok(negationPreserved("Do not let the back arch.", "Laat de rug niet hol trekken."));
  assert.ok(negationPreserved("Avoid flaring the elbows.", "Vermijd het spreiden van de ellebogen."));
  assert.ok(negationPreserved("Use a light weight.", "Gebruik een licht gewicht."));
});

test("vervoegde ontkenningen tellen mee (regressie: 27 valse alarmen)", () => {
  // Nederlands zet het werkwoord achteraan en verbuigt het; zonder prefix-
  // matching viel dit buiten de match en sloeg het vangnet onnodig aan.
  assert.ok(
    negationPreserved(
      "Use a light weight to avoid swinging the bar up.",
      "Gebruik een licht gewicht om te voorkomen dat je de stang omhoog zwaait."
    )
  );
  assert.ok(
    negationPreserved(
      "Keep your wrists aligned to prevent strain.",
      "Houd je polsen uitgelijnd om spanning te voorkomen."
    )
  );
  assert.ok(
    negationPreserved("Avoid twisting your torso.", "Vermijden dat je romp draait.")
  );
});

test("ontkenning verdwenen → false (betekenis klapt om)", () => {
  // Dit is de echte MT-uitvoer die we empirisch aantroffen.
  assert.equal(
    negationPreserved(
      "Do not let the lower back arch during the set.",
      "Laat de onderrug hol trekken tijdens de set."
    ),
    false
  );
  assert.equal(negationPreserved("Never round your back.", "Rond je rug af."), false);
});

test("bron zonder ontkenning wordt nooit gevlagd", () => {
  assert.ok(negationPreserved("Squeeze the glutes at the top.", "Knijp de glutes samen bovenaan."));
});
