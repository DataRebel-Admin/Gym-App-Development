// Anatomische spier-heatmap (RepDB muscle_heatmap-overlays) — puur, géén
// `server-only` (idioom lib/exercise-types.ts): gedeeld door de server-laag
// (lib/muscle-analysis.ts), de client-component, het asset-script én de tests.
//
// De RepDB Standard-bundel (v1.41) levert per aanzicht een neutrale basisfoto
// plus per spier een transparante overlay waarvan vorm en arcering volledig in
// het alpha-kanaal zitten — de kleur geven wij er runtime aan (tenant-accent in
// vijf intensiteiten). De app gebruikt VERKLEINDE afgeleiden in een eigen map
// (`images/muscle_heatmap_app/`, script `npm run muscles:heatmap`): de
// originelen zijn 1510×4064 (basis ~3 MB) en dat is te zwaar voor mobiel.
//
// LET OP: CSS `mask-image` haalt beelden — anders dan `<img>` — als
// CORS-request op. Het asset-script zet daarom een CORS-regel (GET, *) op het
// storage-account; zonder die regel blokkeert de browser élke overlay en
// blijft het figuur grijs (zo gevonden: basis zichtbaar, nul kleur).
//
// Hit-testing (welke spier is aangetikt) loopt via een kleine indexkaart-PNG
// per aanzicht in `public/muscle-heatmap/` (gegenereerd door het script):
// elke pixel draagt de index+1 van de zwaarst-dekkende spier, 0 = geen —
// goedkoper dan 74 overlays client-side decoderen. De volgorde van
// `heatmapViewMuscles()` is daarmee een CONTRACT tussen script en client —
// beide lezen 'm hier.

import type { MuscleRegion } from "@/lib/muscle-map";
import { resolveRegion, type ExerciseMuscleInfo, type MuscleLevel } from "@/lib/muscle-map";
import { libraryMediaUrl } from "@/lib/exercise-library/media";

export type HeatmapView = "front" | "back";

/** Canvas-afmetingen van de RepDB-bron (alle bestanden per aanzicht identiek). */
export const HEATMAP_CANVAS: Record<HeatmapView, { width: number; height: number }> = {
  front: { width: 1510, height: 4064 },
  back: { width: 1562, height: 4027 },
};

/** Breedte van de verkleinde weergave-assets op Azure (hoogte volgt de ratio). */
export const HEATMAP_ASSET_WIDTH = 480;
/** Breedte van de hit-test-indexkaarten in public/muscle-heatmap/. */
export const HEATMAP_HITMAP_WIDTH = 120;

export type HeatmapMuscleMeta = {
  /** NL-referentienaam (documentatie/fallback). De UI vertaalt via i18n:
   *  `member.muscles.heat.muscles.<name>` (nl/en/fy) — een test dwingt af dat
   *  élke registry-spier daar een sleutel heeft. */
  label: string;
  /** Op welke aanzicht(en) de bundel een overlay levert. */
  views: HeatmapView[];
};

/**
 * Alle 32 overlay-spieren uit de bundel (18 voor + 19 achter, 5 op beide).
 * Sleutels = de `name` uit images/muscle_heatmap/manifest.json; links/rechts
 * zijn aparte bestanden (`_L`/`_R`) maar delen één registratie — asymmetrie
 * tonen kan later zonder nieuwe assets. Volgorde is stabiel houden: de
 * hit-test-indexkaarten zijn erop gebouwd (zie kop van dit bestand).
 */
export const HEATMAP_MUSCLES: Record<string, HeatmapMuscleMeta> = {
  // Voorkant
  pectoralis_major: { label: "Borst", views: ["front"] },
  abdominals: { label: "Buikspieren", views: ["front"] },
  obliques: { label: "Schuine buikspieren", views: ["front"] },
  biceps_brachii: { label: "Biceps", views: ["front"] },
  palmaris_longus: { label: "Onderarmbuigers", views: ["front"] },
  sternocleidomastoid: { label: "Hals", views: ["front"] },
  pectineus_sartorius: { label: "Pectineus & sartorius", views: ["front"] },
  adductor_longus: { label: "Adductor longus", views: ["front"] },
  rectus_femoris: { label: "Rectus femoris (quadriceps)", views: ["front"] },
  vastus_lateralis: { label: "Vastus lateralis (quadriceps)", views: ["front"] },
  vastus_medialis: { label: "Vastus medialis (quadriceps)", views: ["front"] },
  tibialis_anterior: { label: "Scheenbeenspier", views: ["front"] },
  gracilis_gastrocnemius: { label: "Binnenzijde onderbeen", views: ["front"] },
  // Beide aanzichten
  deltoids: { label: "Schouders (deltoïden)", views: ["front", "back"] },
  trapezius: { label: "Trapezius", views: ["front", "back"] },
  triceps: { label: "Triceps", views: ["front", "back"] },
  brachioradialis: { label: "Brachioradialis", views: ["front", "back"] },
  gracilis: { label: "Gracilis", views: ["front", "back"] },
  // Achterkant
  latissimus_dorsi: { label: "Lats", views: ["back"] },
  infraspinatus_teres_minor: { label: "Rotator cuff", views: ["back"] },
  erector_spinae: { label: "Rugstrekkers", views: ["back"] },
  extensor_carpi: { label: "Onderarmstrekkers", views: ["back"] },
  anconeus: { label: "Anconeus", views: ["back"] },
  gluteus_maximus: { label: "Grote bilspier", views: ["back"] },
  gluteus_medius: { label: "Middelste bilspier", views: ["back"] },
  iliotibial_band: { label: "IT-band", views: ["back"] },
  adductor_magnus: { label: "Adductor magnus", views: ["back"] },
  biceps_femoris: { label: "Biceps femoris (hamstring)", views: ["back"] },
  semitendinosus: { label: "Semitendinosus (hamstring)", views: ["back"] },
  semimembranosus: { label: "Semimembranosus (hamstring)", views: ["back"] },
  gastrocnemius: { label: "Kuit (gastrocnemius)", views: ["back"] },
  soleus: { label: "Soleus (kuit)", views: ["back"] },
};

export const HEATMAP_MUSCLE_ORDER = Object.keys(HEATMAP_MUSCLES);

/**
 * Spieren van één aanzicht, in vaste registry-volgorde. CONTRACT met de
 * hit-test-indexkaart: pixelwaarde n (1-based) = element n-1 van deze lijst.
 */
export function heatmapViewMuscles(view: HeatmapView): string[] {
  return HEATMAP_MUSCLE_ORDER.filter((name) => HEATMAP_MUSCLES[name].views.includes(view));
}

// --- Media-keys (relatief; absolute URL via libraryMediaUrl) ----------------

/** Map met app-afgeleiden — bewust NIET de ruwe bundel-map (`muscle_heatmap`):
 *  die bevat originelen op vol formaat en een eigen manifest van RepDB. */
const APP_FOLDER = "images/muscle_heatmap_app";

export function heatmapBaseKey(view: HeatmapView): string {
  return `${APP_FOLDER}/${view}_base.webp`;
}

/** Overlay-keys (links + rechts) van een spier op een aanzicht. */
export function heatmapOverlayKeys(view: HeatmapView, name: string): string[] {
  return [`${APP_FOLDER}/${view}_${name}_L.webp`, `${APP_FOLDER}/${view}_${name}_R.webp`];
}

/** Bestandsnamen in de RUWE bundel-map (bron voor het generatie-script). */
export function heatmapSourceFiles(view: HeatmapView, name: string): string[] {
  return [`${view}_${name}_L.webp`, `${view}_${name}_R.webp`];
}

/** Same-origin hit-test-indexkaart (gegenereerd door `npm run muscles:heatmap`). */
export function heatmapHitmapPath(view: HeatmapView): string {
  return `/muscle-heatmap/${view}.png`;
}

// --- Ruw spier-label → overlay-spieren (3-weg, granulair waar het kan) ------
//
// Bibliotheek-oefeningen dragen RepDB-slugs ("latissimus_dorsi") — die mappen
// granulair (alleen de lats lichten op). Klassieke/eigen oefeningen dragen
// vrije tekst of Nederlandse labels — die vallen terug op de 16-regio-mapping
// (resolveRegion) en kleuren de hele regio-groep. Liever iets breder gekleurd
// dan stil niets (zelfde afweging als RAW_TO_REGION, maar dan omgekeerd: de
// regio-terugval is hier het vangnet, niet de hoofdroute).

/** Regio → overlay-spieren (vangnet voor niet-RepDB-labels). */
export const REGION_TO_HEATMAP: Record<MuscleRegion, string[]> = {
  chest: ["pectoralis_major"],
  shoulders: ["deltoids"],
  biceps: ["biceps_brachii"],
  triceps: ["triceps"],
  forearms: ["brachioradialis", "extensor_carpi", "palmaris_longus"],
  abs: ["abdominals"],
  obliques: ["obliques"],
  traps: ["trapezius"],
  lats: ["latissimus_dorsi"],
  upperBack: ["trapezius", "infraspinatus_teres_minor"],
  lowerBack: ["erector_spinae"],
  glutes: ["gluteus_maximus", "gluteus_medius"],
  quads: ["rectus_femoris", "vastus_lateralis", "vastus_medialis"],
  hamstrings: ["biceps_femoris", "semitendinosus", "semimembranosus"],
  adductors: ["adductor_longus", "adductor_magnus", "gracilis", "pectineus_sartorius"],
  calves: ["gastrocnemius", "soleus", "gracilis_gastrocnemius"],
};

/**
 * Granulaire overrides — sleutels genormaliseerd (lowercase, `_` → spatie),
 * net als RAW_TO_REGION. Dekt álle 30 RepDB-spierslugs waar de regio-terugval
 * te grof zou kleuren (gastrocnemius zou anders óók de soleus oplichten), plus
 * een paar vrije-tekst-labels zonder eigen regio-route.
 */
const RAW_TO_HEATMAP: Record<string, string[]> = {
  // RepDB-slugs, granulair
  "anterior deltoid": ["deltoids"],
  "lateral deltoid": ["deltoids"],
  "posterior deltoid": ["deltoids"],
  supraspinatus: ["deltoids"],
  "biceps brachii": ["biceps_brachii"],
  brachialis: ["biceps_brachii"],
  "triceps brachii": ["triceps", "anconeus"],
  brachioradialis: ["brachioradialis"],
  "forearm extensors": ["extensor_carpi"],
  "forearm flexors": ["palmaris_longus"],
  "erector spinae": ["erector_spinae"],
  "quadratus lumborum": ["erector_spinae"],
  "latissimus dorsi": ["latissimus_dorsi"],
  rhomboids: ["trapezius"],
  trapezius: ["trapezius"],
  "pectoralis major": ["pectoralis_major"],
  "rectus abdominis": ["abdominals"],
  "transverse abdominis": ["abdominals"],
  "serratus anterior": ["obliques"],
  obliques: ["obliques"],
  "gluteus maximus": ["gluteus_maximus"],
  "gluteus medius": ["gluteus_medius"],
  abductors: ["gluteus_medius", "iliotibial_band"],
  "hip flexors": ["pectineus_sartorius", "rectus_femoris"],
  gastrocnemius: ["gastrocnemius", "gracilis_gastrocnemius"],
  soleus: ["soleus"],
  // Vrije-tekst-labels zonder (bruikbare) regio-route
  "tibialis anterior": ["tibialis_anterior"],
  "gracilis": ["gracilis"],
  neck: ["sternocleidomastoid"],
  sternocleidomastoid: ["sternocleidomastoid"],
  nek: ["sternocleidomastoid"],
  hals: ["sternocleidomastoid"],
  // Nederlandse bibliotheek-weergavenamen die granulairder kunnen dan de regio
  onderarmstrekkers: ["extensor_carpi"],
  onderarmbuigers: ["palmaris_longus"],
  "middelste bilspier": ["gluteus_medius"],
};

/**
 * Normaliseer één ruw spier-label naar overlay-spieren. Granulaire override
 * wint; anders regio-terugval; onbekend → leeg (liever geen kleur dan de
 * verkeerde spier — zelfde principe als resolveRegion).
 */
export function resolveHeatmapMuscles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const key = raw.trim().toLowerCase().replace(/_/g, " ");
  const direct = RAW_TO_HEATMAP[key];
  if (direct) return direct;
  const region = resolveRegion(raw);
  return region ? REGION_TO_HEATMAP[region] : [];
}

// --- Telregel (spiegel van accumulateMuscleVolume, maar per overlay-spier) --

/** Primaire overlay-spieren van een oefening (bron-bewust, zie muscle-map). */
export function primaryHeatmapMuscles(ex: ExerciseMuscleInfo): string[] {
  const lib = ex.library?.primaryMuscles ?? [];
  const raws = lib.length > 0
    ? lib
    : [ex.targetMuscle ?? ex.catalog?.target ?? ex.catalog?.muscleGroup].filter(
        (r): r is string => r != null
      );
  return dedupe(raws.flatMap(resolveHeatmapMuscles));
}

/** Secundaire overlay-spieren (bibliotheek + catalogus + eigen spiergroepen). */
export function secondaryHeatmapMuscles(ex: ExerciseMuscleInfo): string[] {
  const raws = [
    ...(ex.library?.secondaryMuscles ?? []),
    ...(ex.catalog?.secondaryMuscles ?? []),
    ...(ex.muscleGroups ?? []),
  ];
  return dedupe(raws.flatMap(resolveHeatmapMuscles));
}

function dedupe(names: string[]): string[] {
  return [...new Set(names)];
}

/**
 * Verdeel `sets` van één oefening over de overlay-spieren: primair vol,
 * secundair half, elke spier max. één keer per oefening — dezelfde telregel
 * als accumulateMuscleVolume, maar op overlay-niveau. Muteert `acc` in-place.
 */
export function accumulateHeatmapVolume(
  acc: Map<string, number>,
  ex: ExerciseMuscleInfo,
  sets: number
): void {
  const seen = new Set<string>();
  for (const name of primaryHeatmapMuscles(ex)) {
    if (seen.has(name)) continue;
    seen.add(name);
    acc.set(name, (acc.get(name) ?? 0) + sets);
  }
  for (const name of secondaryHeatmapMuscles(ex)) {
    if (seen.has(name)) continue;
    seen.add(name);
    acc.set(name, (acc.get(name) ?? 0) + sets * 0.5);
  }
}

// --- Kleur: tenant-accent in vijf intensiteiten -----------------------------
//
// De overlays zijn wit-met-alpha; de tint komt van `var(--tenant-accent)` en de
// intensiteit van de opacity per volume-niveau. Zo volgt de heatmap de
// whitelabel-huisstijl (bij de demo-tenant is dat precies Rebel Orange) en
// blijft de anatomische arcering uit het alpha-kanaal zichtbaar. De
// betekenis-schaal (rood→groen) blijft bestaan in de vergelijkingsbalken
// eronder — dit figuur toont intensiteit, niet oordeel.

export const HEATMAP_LEVEL_OPACITY: Record<MuscleLevel, number> = {
  0: 0,
  1: 0.28,
  2: 0.45,
  3: 0.62,
  4: 0.8,
  5: 1,
};

// --- Asset-bundel voor de client-component ----------------------------------

export type HeatmapMuscleAsset = {
  name: string;
  /** Overlay-URL's (links + rechts) op Azure. */
  urls: string[];
};

export type HeatmapViewAssets = {
  view: HeatmapView;
  baseUrl: string;
  /** Hoogte ÷ breedte van het canvas (alle bestanden van het aanzicht delen die). */
  aspect: number;
  hitmapPath: string;
  muscles: HeatmapMuscleAsset[];
};

/**
 * Alle weergave-info per aanzicht. In de Server Component aanroepen en als prop
 * doorgeven: `libraryMediaUrl` leest env die alleen server-side bestaat.
 */
export function buildHeatmapAssets(): Record<HeatmapView, HeatmapViewAssets> {
  const build = (view: HeatmapView): HeatmapViewAssets => ({
    view,
    baseUrl: libraryMediaUrl(heatmapBaseKey(view))!,
    aspect: HEATMAP_CANVAS[view].height / HEATMAP_CANVAS[view].width,
    hitmapPath: heatmapHitmapPath(view),
    muscles: heatmapViewMuscles(view).map((name) => ({
      name,
      urls: heatmapOverlayKeys(view, name).map((k) => libraryMediaUrl(k)!),
    })),
  });
  return { front: build("front"), back: build("back") };
}
