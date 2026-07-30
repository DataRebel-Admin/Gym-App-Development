/**
 * Nederlandse vertaal-hulplaag voor fitness-content — puur en getest
 * (`tests/translate-fitness-nl.test.ts`), géén `server-only`.
 *
 * Generieke machinevertaling levert goed proza maar mangelt sportschool-jargon:
 * "bent-over row" → "gebogen rij", "posterior deltoids" → "achterste delta's",
 * "knee tucks" → "knie-inperkingen". Drie lagen lossen dat op:
 *
 *  1. `protectTerms()` — Azure's *dynamic dictionary* forceert de juiste term
 *     vóór de vertaling. UITSLUITEND zelfstandige naamwoorden/termen: een
 *     geforceerde wérkwoordsfrase kan de zinsbouw slopen (empirisch getest:
 *     "Do not let the <forced>lower back arch</forced>" verloor de ontkenning).
 *  2. `applyDutchFixes()` — chirurgische correcties op de Nederlandse uitvoer
 *     voor precies die werkwoordsvormen die MT structureel fout doet.
 *  3. `negationPreserved()` — vangnet: verdwijnt een ontkenning uit een
 *     instructie ("do not let…", "avoid…", "stop before…"), dan is de Duitse
 *     betekenis omgeklapt en is de tekst gevaarlijk. De aanroeper valt in dat
 *     geval terug op het Engels (fail-safe, nooit fail-wrong).
 *
 * Nieuwe term = één regel in FORCED_TERMS of DUTCH_FIXES.
 */

/**
 * Termen die de vertaler moet overnemen zoals opgegeven. Sleutel = Engelse
 * term (case-insensitive), waarde = gewenste Nederlandse term.
 *
 * **Beleid: namen van apparaten en oefeningen worden NIET vertaald** — in
 * Nederlandse sportscholen is het Engels daarvoor de gangbare taal. De waarden
 * zijn daarom identiek aan de sleutel; dat forceren is geen no-op maar juist
 * nodig, want MT wisselde anders willekeurig ("dumbbell" → soms "halter", soms
 * "domoor", "bent-over row" → "gebogen rij"). Alleen anatomische/algemene
 * termen krijgen een Nederlandse waarde.
 *
 * ALLEEN zelfstandige naamwoorden en vaste termen — geen clausules/werkwoords-
 * frases (die slopen de zinsbouw; zie de moduleheader).
 */
export const FORCED_TERMS: Record<string, string> = {
  // Materiaal — blijft Engels
  dumbbell: "dumbbell",
  dumbbells: "dumbbells",
  barbell: "barbell",
  kettlebell: "kettlebell",
  kettlebells: "kettlebells",
  "trap bar": "trap bar",
  "ez bar": "EZ-bar",
  landmine: "landmine",
  "ab wheel": "ab wheel",
  "air bike": "air bike",
  "plyo box": "plyo box",
  "battle rope": "battle rope",
  "battle ropes": "battle ropes",
  "resistance band": "resistance band",
  "loop band": "loop band",
  "suspension trainer": "suspension trainer",
  "medicine ball": "medicine ball",
  "slam ball": "slam ball",
  "wall ball": "wall ball",
  "stability ball": "stability ball",
  "jump rope": "jump rope",
  "pull-up bar": "pull-up bar",
  "dip station": "dip station",
  "smith machine": "smith machine",
  "leg press": "leg press",
  "pec deck": "pec deck",
  "hack squat": "hack squat",
  "ski erg": "ski erg",
  "stair climber": "stair climber",
  treadmill: "treadmill",
  elliptical: "elliptical",
  "stationary bike": "stationary bike",
  rower: "rower",
  "wrist roller": "wrist roller",
  "hand gripper": "hand gripper",
  "climbing rope": "climbing rope",
  sandbag: "sandbag",
  sled: "sled",
  rings: "rings",

  // Spiergroepen — anatomie mág Nederlands (geen oefening-/apparaatnaam);
  // MT maakte er "achterste delta's" van, wat een rivierdelta is.
  "posterior deltoids": "achterste deltoïden",
  "anterior deltoids": "voorste deltoïden",
  "lateral deltoids": "zijdelingse deltoïden",
  "rear delts": "achterste deltoïden",
  "front delts": "voorste deltoïden",
  "side delts": "zijdelingse deltoïden",
  delts: "deltoïden",
  lats: "lats",
  glutes: "glutes",
  hamstrings: "hamstrings",
  quads: "quads",
  traps: "traps",
  "rotator cuff": "rotator cuff",
  "erector spinae": "erector spinae",

  // Oefening-/bewegingsnamen — blijven Engels (zelfstandig gebruikt)
  "bent-over row": "bent-over row",
  "barbell row": "barbell row",
  "dumbbell row": "dumbbell row",
  "cable row": "cable row",
  "seated row": "seated row",
  "upright row": "upright row",
  "inverted row": "inverted row",
  "renegade row": "renegade row",
  "high row": "high row",
  "low row": "low row",
  "single-arm row": "single-arm row",
  "one-arm row": "one-arm row",
  "chest-supported row": "chest-supported row",
  "knee tuck": "knee tuck",
  "knee tucks": "knee tucks",
  "hip hinge": "hip hinge",
  "front lever": "front lever",
  "back lever": "back lever",
  "straight-body lever": "straight-body lever",
  lockout: "lockout",
  "hollow body": "hollow body",
  "good morning": "good morning",
  "push press": "push press",
  "overhead press": "overhead press",
  "bench press": "bench press",
  "lat pulldown": "lat pulldown",
  deadlift: "deadlift",
  "romanian deadlift": "Romanian deadlift",
  "split squat": "split squat",
  "box squat": "box squat",
  burpees: "burpees",
  "mountain climbers": "mountain climbers",

  // Losse termen die MT letterlijk neemt
  reps: "herhalingen",
  rep: "herhaling",
  "too hard": "te moeilijk",
};

/**
 * Chirurgische correcties op de Nederlandse uitvoer. Uitsluitend voor
 * werkwoordsvormen/idiomen die MT structureel fout doet — geforceerde
 * dictionary-termen zouden daar de zinsbouw breken.
 */
export const DUTCH_FIXES: [RegExp, string][] = [
  // "the back arches" → MT las 'arches' als zelfstandig naamwoord ("bogen")
  [/\bde rugbogen komen\b/gi, "de rug hol trekt"],
  [/\bde rug bogen\b/gi, "de rug hol trekt"],
  [/\brugbogen\b/gi, "de rug hol trekt"],
  [/\bniet boog\b/gi, "niet hol trekken"],
  [/\bniet mag boog\b/gi, "niet hol mag trekken"],
  [/\b(de |je |uw )?onderrug niet boog\b/gi, "$1onderrug niet hol trekken"],

  // --- "hinge" → hip hinge / kantelen (MT: "scharnier", 55×) ---------------
  // Samenstellingen eerst, dan werkwoordsvormen, dan het losse woord.
  [/\bheup-?\s?scharnier(\s|-)?patroon\b/gi, "hip hinge-patroon"],
  [/\bheupscharnier(beweging|trek|positie)\b/gi, "hip hinge"],
  [/\bheupscharnier\b/gi, "hip hinge"],
  [/\bscharnierbeweging(en)?\b/gi, "hip hinge"],
  [/\bscharnierpositie\b/gi, "hip hinge"],
  [/\bscharnierpatroon\b/gi, "hip hinge-patroon"],
  [/\bscharnierhoek\b/gi, "hip hinge-hoek"],
  // "hinged" (voorovergebogen romp) — bijvoeglijk gebruikt
  [/\bscharnierende\b/gi, "voorovergebogen"],
  [/\bscharnierend\b/gi, "voorovergebogen"],
  [/\bscharnier(en)? (bij|vanuit|in|vanaf) de heupen\b/gi, "kantel vanuit je heupen"],
  [/\bte scharnieren\b/gi, "te kantelen"],
  [/\bscharnieren\b/gi, "kantelen"],
  [/\bscharniert\b/gi, "kantelt"],
  [/\b(een|het|de) scharnier\b/gi, "$1 hip hinge"],
  [/\bscharnier\b/gi, "kantel"],

  // --- Overige bewegingsnamen die MT letterlijk vertaalde ------------------
  [/\bglutebrug(gen)?\b/gi, "glute bridge"],
  [/\bglute-max brug\b/gi, "glute bridge"],
  [/\bin een brug\b/gi, "in een bridge"],
  [/\bherhaling brug\b/gi, "herhaling bridge"],
  [/\bkrullen\b/gi, "curlen"],
  [/\bkrult\b/gi, "curlt"],
  [/\bgekruld\b/gi, "gecurld"],
  [/\bkrul\b/gi, "curl"],
  [/\b(de|een|elke|je|iedere) pers\b/gi, "$1 press"],
  [/\bschuine kraak\b/gi, "schuine crunch"],
  [/\b(een|de) kraak\b/gi, "$1 crunch"],
  [/\bkraakt en samenknijpt\b/gi, "samenknijpt"],
  [/\bde klokken\b/gi, "de kettlebells"],
  [/\bde klok\b/gi, "de kettlebell"],
  [/\bde ruk\b/gi, "de jerk"],
  // "squat" → MT: "hurk(en)". Specifieke frases eerst, dan het losse woord.
  [/\bkwart-?\s?hurk\b/gi, "kwart-squat"],
  [/\bhurkpositie\b/gi, "squatpositie"],
  [/\bhurk neer\b/gi, "zak in een squat"],
  [/\bhurk naar beneden\b/gi, "zak naar beneden in de squat"],
  [/\bhurk tot\b/gi, "zak tot"],
  [/\bhurkt\b/gi, "zakt"],
  [/\bhurken\b/gi, "squats"],
  [/\bhurk\b/gi, "squat"],
  [/\b(een|de) trui\b/gi, "$1 pullover"],
  [/\bbandjes\b/gi, "straps"],
  // Anatomie: MT maakte er rivierdelta's en "deltawortels" van
  [/\bdeltawortels?\b/gi, "deltoïden"],
  [/\bhet (voorste|achterste|laterale|zijwaartse) deltaspier\b/gi, "de $1 deltoïde"],
  [/\bdeltaspieren\b/gi, "deltoïden"],
  [/\bdeltaspier\b/gi, "deltoïde"],
  [/\bdelta'?s\b/gi, "deltoïden"],
  // --- "drive" → MT maakte er autorijden van ("Rijd door je hielen", 88×) ----
  // Specifieke voorzetsel-combinaties eerst; "duw" is de imperatieve terugval.
  [/\benkelvoudig rijden\b/gi, "één been"],
  [/\b(rijd|drijf)\s+door\b/gi, "zet kracht door"],
  [/\b(rijd|drijf)\s+(de|je|uw)\s+heupen\b/gi, "duw $2 heupen"],
  [/\b(rijd|drijf)\s+met\b/gi, "zet kracht met"],
  [/\b(rijd|drijf)\s+omhoog\b/gi, "duw omhoog"],
  [/\bwordt gedreven\b/gi, "wordt gedrukt"],
  [/\bgedreven\b/gi, "gedrukt"],
  [/\bnaar boven drijft\b/gi, "naar boven duwt"],
  [/\brijden\b/gi, "duwen"],
  [/\b(rijd|drijf)\b/gi, "duw"],
  // LET OP: "drijft" blijft staan waar het écht "drifts" betekent ("de bal
  // drijft van links naar rechts") — vandaar de specifieke frase hierboven.
  [/\bkernsteun\b/gi, "core-steun"],

  // --- "arch" als zelfstandig naamwoord: rug-holling, géén boog ------------
  // LET OP: "brede boog"/"in een boog" is een échte arc-beweging en blijft.
  [/\bboog in (je|de|uw) (onderrug|rug|lage rug)\b/gi, "holling in $1 $2"],
  [/\blichte boog\b/gi, "lichte holling"],
  [/\bpiek of boog\b/gi, "pike of holling"],
  [/\bhurkbeweging\b/gi, "squatbeweging"],
  // Laatste redmiddel voor resterende scharnier-samenstellingen.
  [/\bscharnier\w*\b/gi, "hip hinge"],

  // MT-spelfouten
  [/\bknyp\b/gi, "knijp"],
  [/\bknell\b/gi, "knijp"],
  // Overige klassiekers
  [/\bdomoor(en)?\b/gi, "dumbbell$1"],
  [/\bketelklok(ken)?\b/gi, "kettlebell$1"],
  [/\bgebogen rij\b/gi, "bent-over row"],
  [/\bhalterroei(en)?\b/gi, "barbell row"],
  [/\bvertegenwoordigers\b/gi, "herhalingen"],
  [/\bknie-inperking(en)?\b/gi, "knee tucks"],
  [/\bluchtfiets\b/gi, "air bike"],
  [/\brecht-lichaamshefboom\b/gi, "straight-body lever"],
  [/\bboogschutters\b/gi, "archer-varianten"],
  [/\bachterste delta'?s\b/gi, "achterste deltoïden"],
  [/\bde kern\b/gi, "de core"],
  // Apparaatnamen die MT alsnog vertaalde (naamsbeleid: Engels aanhouden)
  [/\bloopband\b/gi, "treadmill"],
  [/\bhometrainer\b/gi, "stationary bike"],
  [/\bspringtouw\b/gi, "jump rope"],
  [/\broeimachine\b/gi, "rower"],
  [/\bhalterstang(en)?\b/gi, "barbell"],
  [/\bhalter(s)?\b/gi, "dumbbell$1"],
  [/\bkabel(machine)?\b/gi, "cable"],
  // Spelling-/idioomartefacten uit de MT-uitvoer
  [/\bverschuiv\b/gi, "verschuif"],
  [/\bhandpalmen naar achteren\b/gi, "handpalmen van je af"],
];

/** Woordgrens-veilig escapen voor een literal in een RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Langste termen eerst zodat "posterior deltoids" wint van "delts", en
// "bent-over row" van "row". Eén gecombineerde regex → geen dubbele treffers.
const TERM_KEYS = Object.keys(FORCED_TERMS).sort((a, b) => b.length - a.length);
const TERM_RE = new RegExp(
  `(?<![\\w-])(${TERM_KEYS.map(escapeRe).join("|")})(?![\\w-])`,
  "gi"
);

/**
 * Omhul bekende termen met Azure's dynamic-dictionary-markup zodat de vertaler
 * ze exact overneemt. Niet-overlappend en case-behoudend (de markup dwingt de
 * uitvoer af, dus de bron-capitalisatie blijft in de zin leesbaar).
 */
export function protectTerms(text: string): string {
  return text.replace(TERM_RE, (match) => {
    const forced = FORCED_TERMS[match.toLowerCase()];
    if (!forced) return match;
    // Beginhoofdletter uit de bron overnemen (zinsbegin).
    const value = /^[A-Z]/.test(match)
      ? forced.charAt(0).toUpperCase() + forced.slice(1)
      : forced;
    return `<mstrans:dictionary translation="${value}">${match}</mstrans:dictionary>`;
  });
}

/**
 * Pas de Nederlandse na-correcties toe.
 *
 * Hoofdletter-behoudend: begon de gevonden tekst met een hoofdletter (typisch
 * aan het begin van een zin), dan krijgt de vervanging die ook. Zonder dit werd
 * "Knell je glutes…" tot "knijp je glutes…" — één regel per vervoeging én per
 * capitalisatie onderhouden is foutgevoelig, dus dit hoort in de functie.
 */
export function applyDutchFixes(text: string): string {
  let out = text;
  for (const [pattern, replacement] of DUTCH_FIXES) {
    out = out.replace(pattern, (match: string, ...rest: unknown[]) => {
      // rest = [...groups, offset, string] → alleen de capture-groepen pakken.
      const groups = rest.slice(0, Math.max(0, rest.length - 2)) as (string | undefined)[];
      const filled = replacement.replace(/\$(\d)/g, (_, n: string) => groups[Number(n) - 1] ?? "");
      if (!/^[A-Z]/.test(match)) return filled;
      return filled.charAt(0).toUpperCase() + filled.slice(1);
    });
  }
  // Elk fragment is een volledige zin (beschrijving/stap/tip), dus het hoort met
  // een hoofdletter te beginnen. Dit heelt ook fragmenten die door een eerdere,
  // niet-hoofdletter-behoudende regel zijn geraakt ("kantel vanuit je heupen…").
  return out.replace(/^([a-zà-öø-ÿ])/, (c) => c.toUpperCase());
}

/** Restanten van de dictionary-markup weghalen (verdedigend, mocht Azure iets
 *  laten staan bij een gedeeltelijke match). */
export function stripDictionaryMarkup(text: string): string {
  return text
    .replace(/<mstrans:dictionary[^>]*>/gi, "")
    .replace(/<\/mstrans:dictionary>/gi, "");
}

/**
 * Ontkenningsmarkers per taal. LET OP de vervoegingen: het Nederlands zet het
 * werkwoord vaak achteraan en verbuigt het ("om te **voorkomen** dat…",
 * "**vermijden**"). Zonder `\w*` viel dat buiten de match en sloeg het vangnet
 * ten onrechte aan op 27 correcte vertalingen — daarom prefix-matching.
 */
const EN_NEGATIONS =
  /\b(do not|don't|does not|doesn't|never|avoid\w*|without|no |not |rather than|instead of|stop before|prevent\w*|cannot|can't|refrain\w*)\b/i;
const NL_NEGATIONS =
  /\b(niet|nooit|geen|voorkom\w*|vermijd\w*|zonder|in plaats van|stop voordat|kan niet|hoeft niet|liever dan|behoed\w*)\b/i;

/**
 * Is de ontkenning uit de Engelse bron bewaard in de Nederlandse vertaling?
 * `false` = de betekenis is mogelijk omgeklapt (MT liet "do not" vallen). De
 * aanroeper hoort dan de Engelse bron te bewaren i.p.v. gevaarlijk-verkeerd
 * Nederlands weg te schrijven.
 */
export function negationPreserved(source: string, translation: string): boolean {
  if (!EN_NEGATIONS.test(source)) return true;
  return NL_NEGATIONS.test(translation);
}
