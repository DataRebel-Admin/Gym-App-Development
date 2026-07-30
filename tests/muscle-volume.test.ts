import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accumulateMuscleVolume,
  primaryMuscleRaws,
  secondaryMuscleRaws,
  regionsOnPolygon,
  resolveRegion,
  levelForWeeklySets,
  MUSCLE_REGIONS,
  MUSCLE_REGION_ORDER,
  REGION_SHARED_POLYGON,
  type ExerciseMuscleInfo,
  type MuscleRegion,
} from "../lib/muscle-map";
import { ANTERIOR, POSTERIOR } from "../components/muscle/body-model-data";

/** Bibliotheek-oefening (RepDB): gecureerde spier-slugs, `targetMuscle` is een
 *  afgeleide weergavenaam. Zoals `bulkAddLibraryToGym` het wegschrijft. */
const squat: ExerciseMuscleInfo = {
  targetMuscle: "Quads",
  muscleGroups: [],
  catalog: null,
  library: {
    primaryMuscles: ["quadriceps", "gluteus_maximus"],
    secondaryMuscles: ["hamstrings", "erector_spinae"],
  },
};

/** Eigen oefening: de tenant-velden zijn de bron, Nederlands ingevuld. */
const eigen: ExerciseMuscleInfo = {
  targetMuscle: "Borst",
  muscleGroups: ["Triceps"],
  catalog: null,
  library: null,
};

/** Klassieke catalogus-oefening (verouderde terugval). */
const klassiek: ExerciseMuscleInfo = {
  targetMuscle: null,
  muscleGroups: [],
  catalog: { target: "lats", muscleGroup: null, secondaryMuscles: ["biceps"] },
  library: null,
};

function volume(ex: ExerciseMuscleInfo, sets: number): Record<string, number> {
  const acc = new Map<MuscleRegion, number>();
  accumulateMuscleVolume(acc, ex, sets);
  return Object.fromEntries(acc);
}

test("bibliotheek-oefening: alle primaire spieren vol, secundaire half", () => {
  // Regressie: de analyse las alléén targetMuscle/catalog → van deze squat kwam
  // uitsluitend `quads` aan en bleven bilspieren/hamstrings/onderrug grijs.
  assert.deepEqual(volume(squat, 4), {
    quads: 4,
    glutes: 4,
    hamstrings: 2,
    lowerBack: 2,
  });
});

test("bibliotheek is leidend boven de afgeleide targetMuscle-naam", () => {
  assert.deepEqual(primaryMuscleRaws(squat), ["quadriceps", "gluteus_maximus"]);
  // Zonder bibliotheek-slugs valt hij terug op het losse label.
  assert.deepEqual(primaryMuscleRaws({ ...squat, library: null }), ["Quads"]);
});

test("eigen en klassieke oefeningen blijven ongewijzigd tellen", () => {
  assert.deepEqual(volume(eigen, 3), { chest: 3, triceps: 1.5 });
  assert.deepEqual(volume(klassiek, 3), { lats: 3, biceps: 1.5 });
  assert.deepEqual(secondaryMuscleRaws(eigen), ["Triceps"]);
});

test("een regio telt per oefening maximaal één keer (geen dubbeltelling)", () => {
  // hamstrings staat zowel primair als secundair → alleen de volle set.
  const dubbel: ExerciseMuscleInfo = {
    targetMuscle: null,
    muscleGroups: ["hamstrings"],
    catalog: null,
    library: { primaryMuscles: ["hamstrings"], secondaryMuscles: ["hamstrings"] },
  };
  assert.deepEqual(volume(dubbel, 5), { hamstrings: 5 });
  // Twee primaire slugs in dezelfde regio (gastrocnemius + soleus = kuiten).
  const kuiten: ExerciseMuscleInfo = {
    targetMuscle: null,
    muscleGroups: [],
    catalog: null,
    library: { primaryMuscles: ["gastrocnemius", "soleus"], secondaryMuscles: [] },
  };
  assert.deepEqual(volume(kuiten, 4), { calves: 4 });
});

test("optellen over meerdere oefeningen bepaalt het heatmap-niveau", () => {
  const acc = new Map<MuscleRegion, number>();
  accumulateMuscleVolume(acc, squat, 4);
  accumulateMuscleVolume(acc, { ...squat, targetMuscle: "Quads" }, 4);
  assert.equal(acc.get("quads"), 8);
  assert.equal(levelForWeeklySets(acc.get("quads") ?? 0), 2);
  assert.equal(acc.get("hamstrings"), 4); // 2× half
  assert.equal(levelForWeeklySets(acc.get("hamstrings") ?? 0), 1);
});

test("een oefening zonder herkenbare spier levert geen volume (geen valse kleur)", () => {
  const cardio: ExerciseMuscleInfo = {
    targetMuscle: "Cardio",
    muscleGroups: [],
    catalog: null,
    library: null,
  };
  assert.deepEqual(volume(cardio, 3), {});
  // Bewust niet gegokt: dekt meerdere regio's.
  assert.equal(resolveRegion("hele lichaam"), null);
  assert.equal(resolveRegion("benen"), null);
});

test("weergavenamen van de bibliotheek resolven (targetMuscle-terugval)", () => {
  // Deze en-namen wijken af van hun slug en kwamen als vrij label niet aan.
  assert.equal(resolveRegion("Side Delts"), "shoulders");
  assert.equal(resolveRegion("Glute Medius"), "glutes");
  assert.equal(resolveRegion("Deep Core"), "abs");
  assert.equal(resolveRegion("Serratus"), "obliques");
  // Slug en weergavenaam komen op dezelfde regio uit.
  assert.equal(resolveRegion("lateral_deltoid"), resolveRegion("Side Delts"));
  assert.equal(resolveRegion("gluteus_medius"), resolveRegion("Glute Medius"));
});

// --- zichtbaarheid op de body-figuur ----------------------------------------

test("élke spierregio is zichtbaar op de figuur (eigen polygoon óf gedeeld)", () => {
  // Regressie: `lats` had geen polygoon in de gevendorde MIT-dataset, dus
  // lat pulldown-volume lichtte nergens op. Deze test vangt dat voor élke regio.
  const withPolygon = new Set<MuscleRegion>();
  for (const part of [...ANTERIOR, ...POSTERIOR]) {
    if (part.region) withPolygon.add(part.region);
  }
  for (const region of MUSCLE_REGION_ORDER) {
    const host = REGION_SHARED_POLYGON[region];
    const visible = withPolygon.has(region) || (host != null && withPolygon.has(host));
    assert.ok(visible, `${region} kleurt nergens op de figuur`);
  }
});

test("lats kleurt mee op de bovenrug-polygoon, in hetzelfde aanzicht", () => {
  assert.deepEqual(regionsOnPolygon("upperBack"), ["upperBack", "lats"]);
  // Een regio zonder meelifters levert alleen zichzelf.
  assert.deepEqual(regionsOnPolygon("chest"), ["chest"]);
  // De meelifter mag niet op een ánder aanzicht staan dan zijn gastheer.
  for (const [region, host] of Object.entries(REGION_SHARED_POLYGON)) {
    const own = MUSCLE_REGIONS[region as MuscleRegion].views;
    const hostViews = MUSCLE_REGIONS[host as MuscleRegion].views;
    for (const v of own) {
      assert.ok(hostViews.includes(v), `${region} zichtbaar op ${v}, ${host} niet`);
    }
  }
});

test("een gedeelde polygoon telt niet dubbel: elke spier houdt eigen volume", () => {
  // Lat pulldown (lats primair, bovenrug secundair) → gescheiden waarden, zodat
  // het detailpaneel ze los toont en de polygoon op de hoogste kleurt.
  const latPulldown: ExerciseMuscleInfo = {
    targetMuscle: "Lats",
    muscleGroups: [],
    catalog: null,
    library: { primaryMuscles: ["latissimus_dorsi"], secondaryMuscles: ["rhomboids"] },
  };
  assert.deepEqual(volume(latPulldown, 4), { lats: 4, upperBack: 2 });
});

test("Nederlandse spierlabels resolven (eigen oefeningen, NL-UI)", () => {
  assert.equal(resolveRegion("Borst"), "chest");
  assert.equal(resolveRegion("Bilspieren"), "glutes");
  assert.equal(resolveRegion("Onderrug"), "lowerBack");
  assert.equal(resolveRegion("Kuiten"), "calves");
  assert.equal(resolveRegion("Schuine buik"), "obliques");
  assert.equal(resolveRegion("Latissimus"), "lats");
});
