import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getContentLocale } from "@/lib/i18n/content-locale";
import { getFavoriteIds } from "@/lib/user-preferences";
import {
  bodyPartLabel,
  datasetLocalePreference,
  pickJsonName,
} from "@/lib/exercise-library/mapping";
import { exerciseThumbUrl } from "@/lib/exercise-thumb";
import { exerciseKinds, KIND_SEARCH_TERMS } from "@/lib/exercise-library/kinds";
import { LIBRARY_CATEGORY_LABEL } from "@/lib/exercise-library/mapping";
import { ExerciseLibrary, type LibraryExercise } from "./exercise-library";

export const metadata = { title: "Oefeningen" };

export default async function MemberExercisesPage() {
  const member = await requireMember();
  const tenant = await getCurrentTenant();
  const dsPref = datasetLocalePreference(await getContentLocale(tenant?.locale));

  const [rows, userRow] = await Promise.all([
    prisma.exercise.findMany({
      where: { tenantId: member.tenantId, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        targetMuscle: true,
        equipment: true,
        exerciseType: true,
        imageUrls: true,
        catalogId: true,
        libraryId: true,
        catalog: {
          select: {
            imageUrl: true,
            gifUrl: true,
            bodyPart: true,
            equipment: true,
            target: true,
          },
        },
        // Bibliotheek (RepDB) = dé standaardbron: media, lichaamsdeel en materiaal
        // komen hiervandaan. Zonder deze selectie blijven alle bibliotheek-
        // oefeningen zonder thumbnail én zonder lichaamsdeel-chip staan.
        library: {
          select: {
            id: true,
            imageAlias: true,
            images: true,
            bodyPart: true,
            equipmentSlug: true,
            isBodyweight: true,
            // Soort-filter (kracht/cardio/core/stretch/yoga/pilates): de
            // categorie plus naam/synoniemen voor de yoga-/pilates-afleiding.
            category: true,
            synonyms: true,
            texts: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: member.id }, select: { preferences: true } }),
  ]);
  const favorites = getFavoriteIds(userRow?.preferences);

  // Materiaalnamen in één keer ophalen (kleine lookup-tabel) zodat zoeken op
  // "dumbbell"/"kettlebell" ook bij bibliotheek-oefeningen werkt.
  const equipmentSlugs = [
    ...new Set(
      rows.map((e) => e.library?.equipmentSlug).filter((s): s is string => Boolean(s))
    ),
  ];
  const equipmentRows = equipmentSlugs.length
    ? await prisma.libraryEquipment.findMany({
        where: { id: { in: equipmentSlugs } },
        select: { id: true, names: true },
      })
    : [];
  const equipmentName = new Map(
    equipmentRows.map((r) => [r.id, pickJsonName(r.names, dsPref) ?? r.id.replace(/_/g, " ")])
  );

  const exercises: LibraryExercise[] = rows.map((e) => {
    const kinds = exerciseKinds({
      exerciseType: e.exerciseType,
      libraryCategory: e.library?.category ?? null,
      names: [
        e.name,
        ...(e.library ? [e.library.id, ...e.library.synonyms, ...e.library.texts.map((t) => t.name)] : []),
      ],
    });
    const rawBodyPart = e.library?.bodyPart ?? e.catalog?.bodyPart ?? null;
    const category = e.library?.category ?? null;
    return {
      id: e.id,
      name: e.name,
      thumbUrl: exerciseThumbUrl(e),
      muscle: e.targetMuscle ?? e.catalog?.target ?? null,
      bodyPart: bodyPartLabel(rawBodyPart),
      equipment:
        e.equipment ??
        (e.library?.equipmentSlug ? (equipmentName.get(e.library.equipmentSlug) ?? null) : null) ??
        (e.library?.isBodyweight ? "Lichaamsgewicht" : null) ??
        e.catalog?.equipment ??
        null,
      kinds,
      // Extra zoekwoorden bovenop naam/spier/materiaal: de rauwe dataset-
      // waarden (Engels — de NL-invoer landt daarop via de query-expansie),
      // de categorie mét label en de soort-woorden van de chips. Zonder dit
      // vond "bovenbenen" of "yoga" hier niets, terwijl de chip er wél staat.
      terms: [
        ...new Set(
          [
            rawBodyPart,
            category,
            category ? LIBRARY_CATEGORY_LABEL[category] : null,
            e.exerciseType,
            ...kinds.flatMap((k) => KIND_SEARCH_TERMS[k]),
            ...(e.library?.synonyms ?? []),
          ].filter((v): v is string => Boolean(v))
        ),
      ],
    };
  });

  return <ExerciseLibrary exercises={exercises} initialFavorites={favorites} />;
}
