/**
 * Nederlandse namen voor de twee kleine bibliotheek-lookups: `LibraryMuscle` en
 * `LibraryEquipment`. Bewust **handmatig gecureerd** en niet machinaal vertaald —
 * het zijn 102 termen en generieke MT maakt er juist hier rommel van
 * ("dumbbell" → "domoor", "posterior deltoids" → "achterste delta's").
 *
 * Géén `server-only`: puur data + pure helper, ook client-bruikbaar (idioom
 * `lib/exercise-types.ts`). Het wegschrijven doet `scripts/translate-library-lookups.ts`.
 *
 * **Twee vocabulaire-regels** (afgeleid van het naamsbeleid in CLAUDE.md):
 *
 * 1. **Spieren = Nederlands**, in het vocabulaire van de spierkaart
 *    (`MUSCLE_REGIONS` in lib/muscle-map.ts) zodat de heatmap, de detailchips en de
 *    diagram-labels dezelfde woorden gebruiken: "Borst", "Bilspieren", "Kuiten".
 *    Anatomisch Latijn dat óók in het Nederlands zo heet blijft staan
 *    ("Trapezius", "Quadriceps", "Soleus"); Engelse afkortingen worden Nederlands
 *    ("Front Delts" → "Voorste deltoïden", "Deep Core" → "Diepe buikspieren").
 *    **Harde eis**: elke naam hier moet door `resolveRegion` naar een regio te
 *    herleiden zijn — de naam belandt namelijk als vrij label in
 *    `Exercise.targetMuscle` bij het toevoegen aan een sportschool, en een
 *    onbekend label kleurt stil géén spier meer op de heatmap. Een test in
 *    `tests/library-lookups-nl.test.ts` dwingt dat af.
 *
 * 2. **Materiaal = het woord dat in een Nederlandse sportschool op het apparaat
 *    staat.** Dat is soms Nederlands ("Loopband", "Crosstrainer", "Beenpers",
 *    "Kabelmachine", "Hometrainer") en soms het Engelse leenwoord dat hier de
 *    gangbare term ís ("Dumbbell", "Barbell", "Kettlebell", "Smith machine").
 *    Leenwoord-of-niet is per term een keuze, geen automatisme.
 */

/** Slug (`LibraryMuscle.id`) → Nederlandse weergavenaam. */
export const MUSCLE_NL: Record<string, string> = {
  abductors: "Abductoren",
  adductors: "Adductoren",
  anterior_deltoid: "Voorste deltoïden",
  biceps_brachii: "Biceps",
  brachialis: "Brachialis",
  brachioradialis: "Brachioradialis",
  erector_spinae: "Onderrug",
  forearm_extensors: "Onderarmstrekkers",
  forearm_flexors: "Onderarmbuigers",
  forearms: "Onderarmen",
  gastrocnemius: "Kuiten",
  gluteus_maximus: "Bilspieren",
  gluteus_medius: "Middelste bilspier",
  hamstrings: "Hamstrings",
  hip_flexors: "Heupbuigers",
  lateral_deltoid: "Middelste deltoïden",
  latissimus_dorsi: "Latissimus",
  obliques: "Schuine buikspieren",
  pectoralis_major: "Borst",
  posterior_deltoid: "Achterste deltoïden",
  quadratus_lumborum: "Quadratus lumborum",
  quadriceps: "Quadriceps",
  rectus_abdominis: "Buikspieren",
  rhomboids: "Rhomboïden",
  serratus_anterior: "Serratus",
  soleus: "Soleus",
  supraspinatus: "Supraspinatus",
  transverse_abdominis: "Diepe buikspieren",
  trapezius: "Trapezius",
  triceps_brachii: "Triceps",
};

/** Slug (`LibraryEquipment.id`) → Nederlandse weergavenaam. */
export const EQUIPMENT_NL: Record<string, string> = {
  ab_crunch_machine: "Buikspiermachine",
  ab_wheel: "Ab wheel",
  air_bike: "Air bike",
  assisted_pullup_machine: "Geassisteerde pull-upmachine",
  back_extension_machine: "Rugextensiemachine",
  barbell: "Barbell",
  battle_rope: "Battle rope",
  belt_squat: "Belt squat",
  bicep_curl_machine: "Bicepscurlmachine",
  bosu_ball: "Bosu-bal",
  cable: "Kabelmachine",
  chest_fly_machine: "Chest fly-machine",
  chest_press_machine: "Chest press-machine",
  climbing_rope: "Klimtouw",
  decline_bench: "Declinebank",
  dip_machine: "Dipmachine",
  dip_station: "Dipstation",
  dumbbell: "Dumbbell",
  elliptical: "Crosstrainer",
  ez_bar: "EZ-bar",
  flat_bench: "Platte bank",
  glute_ham_developer: "Glute ham developer",
  glute_kickback_machine: "Glute kickback-machine",
  hack_squat: "Hacksquatmachine",
  hand_gripper: "Handknijper",
  hip_abduction_machine: "Abductiemachine",
  hip_adduction_machine: "Adductiemachine",
  hip_thrust_machine: "Hip thrust-machine",
  incline_bench: "Inclinebank",
  jump_rope: "Springtouw",
  kettlebell: "Kettlebell",
  landmine: "Landmine",
  lat_pulldown_machine: "Lat pulldown-machine",
  lateral_raise_machine: "Lateral raise-machine",
  leg_curl: "Leg curl",
  leg_extension: "Leg extension",
  leg_press: "Beenpers",
  loop_band: "Miniband",
  medicine_ball: "Medicijnbal",
  pec_deck: "Pec deck",
  pendulum_squat: "Pendulum squat",
  plates: "Halterschijf",
  plyo_box: "Plyobox",
  preacher_curl_machine: "Preacher curl-machine",
  pull_up_bar: "Optrekstang",
  pullover_machine: "Pullovermachine",
  resistance_band: "Weerstandsband",
  reverse_fly_machine: "Reverse fly-machine",
  rings: "Gymnastiekringen",
  rower: "Roeitrainer",
  sandbag: "Sandbag",
  seated_calf_raise_machine: "Zittende kuitmachine",
  seated_row_machine: "Zittende roeimachine",
  shoulder_press_machine: "Schouderpersmachine",
  shrug_machine: "Shrugmachine",
  ski_erg: "Ski erg",
  slam_ball: "Slam ball",
  sled: "Sled",
  smith_machine: "Smith machine",
  stability_ball: "Fitnessbal",
  stair_climber: "Traptrainer",
  standing_calf_raise_machine: "Staande kuitmachine",
  stationary_bike: "Hometrainer",
  stepmill: "Stepmill",
  suspension_trainer: "Suspensietrainer",
  t_bar_row_machine: "T-bar row-machine",
  trap_bar: "Trap bar",
  treadmill: "Loopband",
  tricep_extension_machine: "Tricepsextensiemachine",
  viking_press_machine: "Viking press-machine",
  wall_ball: "Wall ball",
  wrist_roller: "Wrist roller",
};

/**
 * Voeg (of vervang) de `nl`-sleutel in een `names`-Json toe zonder de andere talen
 * te raken. Onbruikbare invoer (null, array, string) levert een verse map — dan is
 * er niets te verliezen.
 */
export function withDutchName(
  names: unknown,
  nl: string
): Record<string, string> {
  const base =
    names && typeof names === "object" && !Array.isArray(names)
      ? (names as Record<string, string>)
      : {};
  return { ...base, nl };
}

/** Heeft deze `names`-Json al exact deze Nederlandse naam? (idempotentie-check) */
export function hasDutchName(names: unknown, nl: string): boolean {
  return (
    !!names &&
    typeof names === "object" &&
    !Array.isArray(names) &&
    (names as Record<string, string>).nl === nl
  );
}
