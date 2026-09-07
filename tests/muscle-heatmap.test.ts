import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HEATMAP_LEVEL_OPACITY,
  HEATMAP_MUSCLES,
  HEATMAP_MUSCLE_ORDER,
  REGION_TO_HEATMAP,
  accumulateHeatmapVolume,
  heatmapViewMuscles,
  primaryHeatmapMuscles,
  resolveHeatmapMuscles,
} from "../lib/muscle-heatmap";
import { MUSCLE_REGION_ORDER } from "../lib/muscle-map";
import type { ExerciseMuscleInfo, MuscleLevel } from "../lib/muscle-map";

/** Alle 30 RepDB-spierslugs (LibraryMuscle.id) — de bron van bibliotheek-oefeningen. */
const REPDB_SLUGS = [
  "abductors", "adductors", "anterior_deltoid", "biceps_brachii", "brachialis",
  "brachioradialis", "erector_spinae", "forearm_extensors", "forearm_flexors",
  "forearms", "gastrocnemius", "gluteus_maximus", "gluteus_medius", "hamstrings",
  "hip_flexors", "lateral_deltoid", "latissimus_dorsi", "obliques",
  "pectoralis_major", "posterior_deltoid", "quadratus_lumborum", "quadriceps",
  "rectus_abdominis", "rhomboids", "serratus_anterior", "soleus", "supraspinatus",
  "transverse_abdominis", "trapezius", "triceps_brachii",
];

test("élke RepDB-spierslug licht minstens één overlay-spier op", () => {
  // De opvolger van de oude polygoon-zichtbaarheidstest: een bibliotheek-
  // oefening mag nooit stil onzichtbaar blijven op het figuur.
  for (const slug of REPDB_SLUGS) {
    const muscles = resolveHeatmapMuscles(slug);
    assert.ok(muscles.length > 0, `${slug} kleurt nergens op de figuur`);
    for (const m of muscles) {
      assert.ok(m in HEATMAP_MUSCLES, `${slug} → ${m} bestaat niet in de registry`);
    }
  }
});

test("élke regio (klassiek/eigen-terugval) dekt bestaande overlay-spieren", () => {
  for (const region of MUSCLE_REGION_ORDER) {
    const muscles = REGION_TO_HEATMAP[region];
    assert.ok(muscles.length > 0, `${region} heeft geen overlay-spieren`);
    for (const m of muscles) {
      assert.ok(m in HEATMAP_MUSCLES, `${region} → ${m} bestaat niet in de registry`);
    }
  }
});

test("granulaire slugs winnen van de grove regio-terugval", () => {
  // gastrocnemius mag níét de soleus meekleuren (dat doet de regio-route wel).
  assert.deepEqual(resolveHeatmapMuscles("gastrocnemius"), [
    "gastrocnemius",
    "gracilis_gastrocnemius",
  ]);
  assert.deepEqual(resolveHeatmapMuscles("soleus"), ["soleus"]);
  assert.deepEqual(resolveHeatmapMuscles("gluteus_medius"), ["gluteus_medius"]);
  // Regio-route: het brede label kleurt de hele groep.
  assert.deepEqual(resolveHeatmapMuscles("calves"), [
    "gastrocnemius",
    "soleus",
    "gracilis_gastrocnemius",
  ]);
  // Nederlandse labels van eigen oefeningen lopen via de regio-terugval.
  assert.deepEqual(resolveHeatmapMuscles("Borst"), ["pectoralis_major"]);
  // Onbekend → geen kleur (nooit gokken).
  assert.deepEqual(resolveHeatmapMuscles("hele lichaam"), []);
});

test("telregel: primair vol, secundair half, max één keer per oefening", () => {
  const squat: ExerciseMuscleInfo = {
    targetMuscle: "Quads",
    muscleGroups: [],
    catalog: null,
    library: {
      primaryMuscles: ["quadriceps", "gluteus_maximus"],
      secondaryMuscles: ["hamstrings", "erector_spinae", "quadriceps"],
    },
  };
  const acc = new Map<string, number>();
  accumulateHeatmapVolume(acc, squat, 4);
  // Primair: alle drie de quadriceps-koppen + grote bilspier vol.
  for (const m of ["rectus_femoris", "vastus_lateralis", "vastus_medialis", "gluteus_maximus"]) {
    assert.equal(acc.get(m), 4, m);
  }
  // Secundair: hamstrings-koppen + rugstrekkers half; quadriceps al primair → geen bonus.
  for (const m of ["biceps_femoris", "semitendinosus", "semimembranosus", "erector_spinae"]) {
    assert.equal(acc.get(m), 2, m);
  }
});

test("bibliotheek-slugs zijn leidend boven de afgeleide targetMuscle-naam", () => {
  const rdl: ExerciseMuscleInfo = {
    targetMuscle: "Hamstrings",
    muscleGroups: [],
    catalog: null,
    library: { primaryMuscles: ["hamstrings"], secondaryMuscles: [] },
  };
  assert.deepEqual(primaryHeatmapMuscles(rdl), [
    "biceps_femoris",
    "semitendinosus",
    "semimembranosus",
  ]);
  // Zonder bibliotheek: terugval op het vrije label (zelfde uitkomst hier).
  assert.deepEqual(primaryHeatmapMuscles({ ...rdl, library: null }), [
    "biceps_femoris",
    "semitendinosus",
    "semimembranosus",
  ]);
});

test("aanzicht-lijsten kloppen met de bundel (18 voor, 19 achter, 5 op beide)", () => {
  const front = heatmapViewMuscles("front");
  const back = heatmapViewMuscles("back");
  assert.equal(front.length, 18);
  assert.equal(back.length, 19);
  const both = front.filter((m) => back.includes(m));
  assert.deepEqual(both.sort(), ["brachioradialis", "deltoids", "gracilis", "trapezius", "triceps"]);
  // Contract met de hit-test-indexkaart: volgorde = registry-volgorde.
  assert.deepEqual(front, HEATMAP_MUSCLE_ORDER.filter((m) => front.includes(m)));
  assert.deepEqual(back, HEATMAP_MUSCLE_ORDER.filter((m) => back.includes(m)));
});

test("élke overlay-spier heeft een vertaalde naam in nl, en en fy", () => {
  // De UI leest labels uit i18n (`member.muscles.heat.muscles.<name>`), niet
  // uit de registry — een nieuwe registry-spier zonder vertaalsleutel zou
  // anders stil de rauwe slug tonen.
  for (const locale of ["nl", "en", "fy"] as const) {
    const messages = JSON.parse(
      readFileSync(join(__dirname, "..", "messages", `${locale}.json`), "utf8")
    );
    const labels = messages.member?.muscles?.heat?.muscles ?? {};
    for (const name of HEATMAP_MUSCLE_ORDER) {
      assert.ok(
        typeof labels[name] === "string" && labels[name].length > 0,
        `${locale}: geen vertaling voor ${name}`
      );
    }
  }
});

test("opacity-schaal loopt strikt op (niveau-verschil blijft zichtbaar)", () => {
  const levels: MuscleLevel[] = [0, 1, 2, 3, 4, 5];
  for (let i = 1; i < levels.length; i++) {
    assert.ok(
      HEATMAP_LEVEL_OPACITY[levels[i]] > HEATMAP_LEVEL_OPACITY[levels[i - 1]],
      `niveau ${levels[i]} niet zichtbaar donkerder dan ${levels[i - 1]}`
    );
  }
  assert.equal(HEATMAP_LEVEL_OPACITY[0], 0);
  assert.equal(HEATMAP_LEVEL_OPACITY[5], 1);
});
