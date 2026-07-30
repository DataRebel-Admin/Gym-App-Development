// scripts/translate-library.ts
//
// Vul de Nederlandse teksten van de oefeningen-bibliotheek (LibraryExerciseText,
// locale "nl") door de Engelse bundel-teksten machinaal te vertalen.
//
// - Bron: de `en`-rijen (origin "dataset"); doel: `nl`-rijen met origin "machine".
// - Idempotent/hervatbaar: oefeningen die al een nl-rij hebben worden
//   overgeslagen (`--force` hertaalt de machine-rijen). Rijen met
//   origin "manual" worden NOOIT overschreven — handwerk is heilig.
// - `library:import` raakt nl-rijen ook niet aan (die loopt alleen en/de/es en
//   slaat origin ≠ "dataset" over) → beide scripts kunnen in elke volgorde.
// - Oefeningnamen blijven standaard Engels: in Nederlandse sportscholen zijn
//   "bench press"/"lat pulldown"/"squat" de gangbare termen, en generieke MT
//   maakt er juist daar rommel van. Met `--names=translate` vertaal je ze wel.
// - Jargon + veiligheid lopen via `lib/translate/fitness-nl.ts`: geforceerde
//   termen vóór de vertaling, Nederlandse na-correcties, en een ontkennings-
//   controle die bij een omgeklapte betekenis op het Engels terugvalt.
//
// Gebruik:
//   npm run library:translate -- --limit=5 --dry-run     (steekproef, schrijft niets)
//   npm run library:translate                            (alles wat nog mist)
//   npm run library:translate -- --force                 (machine-rijen hertalen)
//   npm run library:translate -- --repair                (alléén Engels gebleven
//     fragmenten opnieuw proberen — na een verscherpte ontkennings-controle; veel
//     goedkoper dan een volledige --force-ronde)
//   npm run library:translate -- --refix                 (glossarium opnieuw
//     toepassen op bestaande rijen — GEEN API-calls, dus gratis en instant;
//     gebruik dit wanneer DUTCH_FIXES uitbreidt)

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  azureTranslatorConfig,
  translateTexts,
} from "../lib/translate/azure";
import {
  protectTerms,
  applyDutchFixes,
  stripDictionaryMarkup,
  negationPreserved,
} from "../lib/translate/fitness-nl";

const prisma = new PrismaClient();

const SOURCE_LOCALE = "en";

function arg(name: string, fallback: string | null = null): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  return process.argv.includes(`--${name}`) ? "" : fallback;
}
const hasFlag = (name: string) =>
  process.argv.includes(`--${name}`) || process.argv.some((a) => a.startsWith(`--${name}=`));

/** Teller van fragmenten die op het Engels zijn teruggevallen (ontkenning weg). */
let negationFallbacks = 0;
const fallbackExamples: { id: string; en: string; nl: string }[] = [];

/**
 * Nabewerking van één fragment: markup-restanten weg, Nederlandse fixes, en de
 * ontkennings-controle. Klapt de betekenis om, dan houden we de Engelse bron —
 * liever leesbaar Engels dan een omgekeerde veiligheidsinstructie
 * (ontwerpprincipe: bij twijfel geen misleidende uitleg).
 */
function finish(source: string, raw: string, exerciseId: string): string {
  const cleaned = applyDutchFixes(stripDictionaryMarkup(raw)).trim();
  if (cleaned === "") return source;
  if (!negationPreserved(source, cleaned)) {
    negationFallbacks++;
    if (fallbackExamples.length < 10) {
      fallbackExamples.push({ id: exerciseId, en: source, nl: cleaned });
    }
    return source;
  }
  return cleaned;
}

/** Eén te vertalen oefening: welke fragmenten en waar ze weer horen. */
type Job = {
  exerciseId: string;
  name: string;
  description: string | null;
  instructions: string[];
  tips: string[];
};

/**
 * Herstel-modus zónder API-calls: pas `applyDutchFixes` opnieuw toe op de
 * bestaande doel-rijen. Bedoeld voor wanneer het glossarium groeit — het
 * corrigeren van jargon is pure tekstbewerking, dus dat hoeft geen nieuwe
 * (betaalde) vertaalronde te kosten. Raakt `origin: "manual"` nooit aan.
 */
async function refix(targetLocale: string, dryRun: boolean) {
  const rows = await prisma.libraryExerciseText.findMany({
    where: { locale: targetLocale, origin: { not: "manual" } },
    select: {
      exerciseId: true,
      description: true,
      instructions: true,
      tips: true,
    },
  });

  let changedRows = 0;
  let changedFragments = 0;
  const examples: string[] = [];

  for (const row of rows) {
    const description = row.description ? applyDutchFixes(row.description) : null;
    const instructions = row.instructions.map(applyDutchFixes);
    const tips = row.tips.map(applyDutchFixes);

    let delta = 0;
    if (description !== row.description) delta++;
    row.instructions.forEach((v, i) => {
      if (instructions[i] !== v) delta++;
    });
    row.tips.forEach((v, i) => {
      if (tips[i] !== v) delta++;
    });
    if (delta === 0) continue;

    changedRows++;
    changedFragments += delta;
    if (examples.length < 8) {
      const before =
        row.description !== description
          ? row.description
          : (row.instructions.find((v, i) => instructions[i] !== v) ??
            row.tips.find((v, i) => tips[i] !== v));
      const after =
        row.description !== description
          ? description
          : (instructions.find((v, i) => row.instructions[i] !== v) ??
            tips.find((v, i) => row.tips[i] !== v));
      examples.push(`  [${row.exerciseId}]\n    voor  ${before}\n    na    ${after}`);
    }

    if (!dryRun) {
      await prisma.libraryExerciseText.update({
        where: { exerciseId_locale: { exerciseId: row.exerciseId, locale: targetLocale } },
        data: { description, instructions, tips },
      });
    }
  }

  console.log(
    `${dryRun ? "Zou corrigeren" : "Gecorrigeerd"}: ${changedFragments} fragment(en) in ` +
      `${changedRows} van ${rows.length} rijen (geen API-calls).`
  );
  for (const ex of examples) console.log(ex);
}

/**
 * Repareer-modus: zoek in de bestaande doel-rijen de fragmenten die identiek aan
 * het Engels zijn (dus zijn teruggevallen op de bron) en vertaal alléén die
 * opnieuw. Bespaart een volledige ronde na het bijstellen van de
 * ontkennings-controle of het glossarium.
 */
async function repair(
  targetLocale: string,
  cfg: NonNullable<ReturnType<typeof azureTranslatorConfig>>,
  dryRun: boolean
) {
  const [enRows, nlRows] = await Promise.all([
    prisma.libraryExerciseText.findMany({
      where: { locale: SOURCE_LOCALE, exercise: { retiredAt: null } },
      select: { exerciseId: true, description: true, instructions: true, tips: true },
    }),
    prisma.libraryExerciseText.findMany({
      where: { locale: targetLocale, origin: { not: "manual" } },
      select: { exerciseId: true, description: true, instructions: true, tips: true },
    }),
  ]);
  const enById = new Map(enRows.map((r) => [r.exerciseId, r]));

  type Spot = { exerciseId: string; field: "description" | "instructions" | "tips"; index: number };
  const spots: Spot[] = [];
  const texts: string[] = [];
  for (const nl of nlRows) {
    const en = enById.get(nl.exerciseId);
    if (!en) continue;
    if (en.description && nl.description === en.description) {
      spots.push({ exerciseId: nl.exerciseId, field: "description", index: 0 });
      texts.push(en.description);
    }
    en.instructions.forEach((step, i) => {
      if (nl.instructions[i] === step && step.trim() !== "") {
        spots.push({ exerciseId: nl.exerciseId, field: "instructions", index: i });
        texts.push(step);
      }
    });
    en.tips.forEach((tip, i) => {
      if (nl.tips[i] === tip && tip.trim() !== "") {
        spots.push({ exerciseId: nl.exerciseId, field: "tips", index: i });
        texts.push(tip);
      }
    });
  }

  console.log(`Te repareren fragmenten (nog Engels): ${texts.length}`);
  if (texts.length === 0) {
    console.log("Niets te repareren.");
    return;
  }

  const translated = await translateTexts(texts.map(protectTerms), cfg, {
    from: SOURCE_LOCALE,
    to: targetLocale,
    onProgress: (done, total) => console.log(`  … ${done}/${total}`),
  });

  // Per oefening de gewijzigde velden samenstellen.
  const byExercise = new Map<
    string,
    { description?: string; instructions?: string[]; tips?: string[] }
  >();
  const nlById = new Map(nlRows.map((r) => [r.exerciseId, r]));
  let stillEnglish = 0;

  spots.forEach((spot, i) => {
    const value = finish(texts[i], translated[i] ?? "", spot.exerciseId);
    if (value === texts[i]) {
      stillEnglish++;
      return; // opnieuw teruggevallen → laat het Engels staan
    }
    const current = byExercise.get(spot.exerciseId) ?? {};
    if (spot.field === "description") {
      current.description = value;
    } else {
      const base =
        current[spot.field] ?? [...(nlById.get(spot.exerciseId)?.[spot.field] ?? [])];
      base[spot.index] = value;
      current[spot.field] = base;
    }
    byExercise.set(spot.exerciseId, current);
  });

  console.log(
    `Gerepareerd: ${spots.length - stillEnglish} fragment(en) in ${byExercise.size} oefening(en)` +
      (stillEnglish > 0 ? ` · ${stillEnglish} blijven Engels (ontkenning nog steeds weg)` : "")
  );
  if (dryRun) {
    for (const [id, patch] of byExercise) console.log(`  ${id}: ${JSON.stringify(patch)}`);
    return;
  }

  for (const [exerciseId, patch] of byExercise) {
    await prisma.libraryExerciseText.update({
      where: { exerciseId_locale: { exerciseId, locale: targetLocale } },
      data: patch,
    });
  }
  console.log(`✓ ${byExercise.size} rij(en) bijgewerkt.`);
}

async function main() {
  const targetLocale = arg("to", "nl") || "nl";
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");
  const repairMode = hasFlag("repair");
  const refixMode = hasFlag("refix");
  const translateNames = arg("names", "keep") === "translate";
  const limitRaw = arg("limit");
  const limit = limitRaw ? Math.max(1, Number(limitRaw) || 0) : null;

  // --refix is puur tekstbewerking op bestaande rijen → geen vertaler nodig.
  if (refixMode) {
    console.log(`Glossarium opnieuw toepassen op ${targetLocale}${dryRun ? " · DRY-RUN" : ""}`);
    await refix(targetLocale, dryRun);
    return;
  }

  const cfg = azureTranslatorConfig();
  if (!cfg) {
    console.error(
      "✗ Geen Azure Translator-config (AZURE_TRANSLATOR_KEY + _REGION). Vertalen niet beschikbaar."
    );
    process.exit(1);
  }
  console.log(
    `Vertalen ${SOURCE_LOCALE} → ${targetLocale} · regio ${cfg.region} · namen: ${
      translateNames ? "vertalen" : "Engels houden"
    }${dryRun ? " · DRY-RUN" : ""}${force ? " · FORCE" : ""}${repairMode ? " · REPAIR" : ""}`
  );

  if (repairMode) {
    await repair(targetLocale, cfg, dryRun);
    return;
  }

  // Bestaande doel-rijen: manual = nooit aanraken, machine = alleen bij --force.
  const existing = await prisma.libraryExerciseText.findMany({
    where: { locale: targetLocale },
    select: { exerciseId: true, origin: true },
  });
  const protectedIds = new Set(
    existing.filter((r) => r.origin === "manual").map((r) => r.exerciseId)
  );
  const alreadyMachine = new Set(
    existing.filter((r) => r.origin !== "manual").map((r) => r.exerciseId)
  );

  const sources = await prisma.libraryExerciseText.findMany({
    where: { locale: SOURCE_LOCALE, exercise: { retiredAt: null } },
    orderBy: { exerciseId: "asc" },
    select: {
      exerciseId: true,
      name: true,
      description: true,
      instructions: true,
      tips: true,
    },
  });

  const jobs: Job[] = [];
  let skippedManual = 0;
  let skippedDone = 0;
  for (const s of sources) {
    if (protectedIds.has(s.exerciseId)) {
      skippedManual++;
      continue;
    }
    if (!force && alreadyMachine.has(s.exerciseId)) {
      skippedDone++;
      continue;
    }
    jobs.push(s);
    if (limit && jobs.length >= limit) break;
  }

  console.log(
    `Te vertalen: ${jobs.length} oefeningen` +
      (skippedDone > 0 ? ` · ${skippedDone} al vertaald` : "") +
      (skippedManual > 0 ? ` · ${skippedManual} handmatig (beschermd)` : "")
  );
  if (jobs.length === 0) {
    console.log("Niets te doen.");
    return;
  }

  // Alle fragmenten platslaan naar één lijst (index-behoudend terugmappen).
  // `srcFragments` houdt het onbewerkte Engels bij voor de ontkennings-controle en
  // de terugval; naar Azure gaat de variant met geforceerde termen.
  const srcFragments: string[] = [];
  const layout = jobs.map((job) => {
    const nameIndex = translateNames ? srcFragments.push(job.name) - 1 : -1;
    const descIndex = job.description ? srcFragments.push(job.description) - 1 : -1;
    const instrStart = srcFragments.length;
    for (const step of job.instructions) srcFragments.push(step);
    const tipsStart = srcFragments.length;
    for (const tip of job.tips) srcFragments.push(tip);
    return { job, nameIndex, descIndex, instrStart, tipsStart };
  });

  console.log(`Fragmenten: ${srcFragments.length}`);
  const translated = await translateTexts(srcFragments.map(protectTerms), cfg, {
    from: SOURCE_LOCALE,
    to: targetLocale,
    onProgress: (done, total) => {
      if (done % 450 === 0 || done === total) console.log(`  … ${done}/${total}`);
    },
  });

  const rows = layout.map(({ job, nameIndex, descIndex, instrStart, tipsStart }) => {
    const pick = (i: number) =>
      i >= 0 ? finish(srcFragments[i], translated[i] ?? "", job.exerciseId) : null;
    return {
      exerciseId: job.exerciseId,
      locale: targetLocale,
      // Naam standaard onvertaald (gym-jargon is in NL grotendeels Engels).
      name: (translateNames ? pick(nameIndex) : null) || job.name,
      description: pick(descIndex),
      instructions: job.instructions.map((_, i) =>
        finish(srcFragments[instrStart + i], translated[instrStart + i] ?? "", job.exerciseId)
      ),
      tips: job.tips.map((_, i) =>
        finish(srcFragments[tipsStart + i], translated[tipsStart + i] ?? "", job.exerciseId)
      ),
    };
  });

  if (negationFallbacks > 0) {
    console.log(
      `\n! ${negationFallbacks} fragment(en) hielden het Engels: de ontkenning ` +
        `verdween in de vertaling (betekenis zou omklappen).`
    );
    for (const ex of fallbackExamples) {
      console.log(`   ${ex.id}\n     EN  ${ex.en}\n     MT  ${ex.nl}`);
    }
  }

  if (dryRun) {
    console.log("\n── Steekproef (niets weggeschreven) ──");
    for (const row of rows) {
      const src = jobs.find((j) => j.exerciseId === row.exerciseId)!;
      console.log(`\n▸ ${row.exerciseId}  [${row.name}]`);
      if (src.description) {
        console.log(`  EN  ${src.description}`);
        console.log(`  NL  ${row.description}`);
      }
      src.instructions.forEach((step, i) => {
        console.log(`  ${i + 1}. EN  ${step}`);
        console.log(`     NL  ${row.instructions[i]}`);
      });
      src.tips.forEach((tip, i) => {
        console.log(`  tip EN  ${tip}`);
        console.log(`  tip NL  ${row.tips[i]}`);
      });
    }
    return;
  }

  const CHUNK = 25;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    await prisma.$transaction(
      slice.map((row) =>
        prisma.libraryExerciseText.upsert({
          where: {
            exerciseId_locale: { exerciseId: row.exerciseId, locale: row.locale },
          },
          create: { ...row, origin: "machine" },
          update: { ...row, origin: "machine" },
        })
      )
    );
    written += slice.length;
    if (written % 100 === 0 || written === rows.length) {
      console.log(`  weggeschreven ${written}/${rows.length}`);
    }
  }

  const total = await prisma.libraryExerciseText.count({
    where: { locale: targetLocale },
  });
  console.log(`\n✓ Klaar: ${written} bijgewerkt · ${total} ${targetLocale}-rijen in totaal.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
