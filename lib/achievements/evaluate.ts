import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  ACHIEVEMENTS,
  CATEGORY_META,
  CATEGORY_ORDER,
  progressOf,
  scopeOf,
  type AchievementCategory,
  type AchievementDef,
} from "@/lib/achievements/definitions";
import { locationScopeKeyFor } from "@/lib/achievements/scope";
import { rarityMeta, type Rarity, RARITY_META } from "@/lib/achievements/rarity";
import { getAchievementTranslator, type AchievementTranslator } from "@/lib/achievements/i18n";
import { computeMemberMetrics, computeMetrics, type MemberMetrics } from "@/lib/achievements/metrics";
import { loadMemberSessions, type MemberSessionRow } from "@/lib/member-stats";
import { notifyAchievementsEarned } from "@/lib/achievements/notify";
import { getHideAchievements } from "@/lib/user-preferences";

/** Absolute origin uit de request-headers (voor e-mail-links). */
async function requestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch {
    /* buiten request-scope (bv. seed) */
  }
  return (process.env.AUTH_URL ?? "").replace(/\/$/, "");
}

/**
 * Evalueer alle achievements voor een lid en ken nieuw behaalde toe. Idempotent:
 * de `@@unique([tenantId, userId, key, locationScopeKey])`-constraint +
 * `skipDuplicates` voorkomen dubbele toekenning, óók bij gelijktijdige
 * evaluaties. ORGANIZATION/GLOBAL-definities tellen over de volledige historie
 * (locationScopeKey ""); LOCATION-definities worden per vestiging-met-activiteit
 * geëvalueerd en zijn per vestiging behaalbaar. Best-effort — een fout mag de
 * onderliggende actie (training afronden, meting toevoegen) nooit breken.
 *
 * @returns de nieuw toegekende definities (voor celebration/UI; een LOCATION-def
 * kan meermaals voorkomen — één per vestiging waar hij zojuist behaald is).
 */
export async function evaluateAndAward(
  memberId: string,
  tenantId: string,
  opts: { notify?: boolean; actor?: { id?: string | null; email?: string | null } } = {}
): Promise<AchievementDef[]> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { achievementsEnabled: true },
    });
    if (!tenant?.achievementsEnabled) return [];

    const [metrics, earnedRows] = await Promise.all([
      computeMemberMetrics(memberId, tenantId),
      prisma.earnedAchievement.findMany({
        where: { tenantId, userId: memberId },
        select: { key: true, locationScopeKey: true },
      }),
    ]);
    // Behaald per scope-eenheid: "<key>|<locationScopeKey>" ("" = org/global).
    const earnedUnits = new Set(earnedRows.map((r) => `${r.key}|${r.locationScopeKey}`));

    const orgDefs = ACHIEVEMENTS.filter((d) => scopeOf(d) !== "LOCATION");
    const locationDefs = ACHIEVEMENTS.filter((d) => scopeOf(d) === "LOCATION");

    const newly: AchievementDef[] = [];
    const rows: {
      key: string;
      category: string;
      rarity: string;
      value: number;
      locationId: string | null;
      locationScopeKey: string;
    }[] = [];

    for (const def of orgDefs) {
      if (earnedUnits.has(`${def.key}|`)) continue;
      const value = metrics[def.metric] ?? 0;
      if (value < def.threshold) continue;
      newly.push(def);
      rows.push({
        key: def.key,
        category: def.category,
        rarity: def.rarity,
        value,
        locationId: null,
        locationScopeKey: locationScopeKeyFor(scopeOf(def)),
      });
    }

    // LOCATION-scope: per vestiging waar het lid afgeronde sessies heeft.
    if (locationDefs.length > 0) {
      const locationGroups = await prisma.workoutSession.groupBy({
        by: ["locationId"],
        where: { tenantId, userId: memberId, endedAt: { not: null } },
      });
      for (const g of locationGroups) {
        const pending = locationDefs.filter(
          (def) => !earnedUnits.has(`${def.key}|${g.locationId}`)
        );
        if (pending.length === 0) continue;
        const locMetrics = await computeMemberMetrics(memberId, tenantId, {
          locationId: g.locationId,
        });
        for (const def of pending) {
          const value = locMetrics[def.metric] ?? 0;
          if (value < def.threshold) continue;
          newly.push(def);
          rows.push({
            key: def.key,
            category: def.category,
            rarity: def.rarity,
            value,
            locationId: g.locationId,
            locationScopeKey: locationScopeKeyFor("LOCATION", g.locationId),
          });
        }
      }
    }

    if (newly.length === 0) return [];

    await prisma.earnedAchievement.createMany({
      data: rows.map((r) => ({ tenantId, userId: memberId, ...r })),
      skipDuplicates: true,
    });

    // Audit + notificaties (best-effort).
    const user = await prisma.user.findFirst({
      where: { id: memberId, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        notificationPrefs: true,
        active: true,
        locale: true,
      },
    });
    const memberLabel = user?.name ?? user?.email ?? memberId;
    const actor = opts.actor ?? { email: "systeem" };
    for (const def of newly) {
      await audit("achievement.earned", {
        actor,
        tenantId,
        targetType: "User",
        targetId: memberId,
        metadata: { name: def.title, key: def.key, rarity: def.rarity, member: memberLabel },
      });
    }

    if (opts.notify !== false && user) {
      const origin = await requestOrigin();
      await notifyAchievementsEarned({ tenantId, user, earned: newly, origin, actor });
    }

    return newly;
  } catch (err) {
    console.error("✗ Achievements evalueren mislukt:", (err as Error).message);
    return [];
  }
}

// --- Weergavemodel (pagina, widgets, passport, profiel) --------------------

export type AchievementItem = {
  def: AchievementDef;
  earned: boolean;
  earnedAt: Date | null;
  /** 0..1 */
  progress: number;
  current: number;
  currentLabel: string;
  targetLabel: string;
  /** Vertaalde rariteitslabel (bv. "Goud"/"Gold"/"Goud") — voor client-render. */
  rarityLabel: string;
  remaining: number;
};

export type AchievementLevel = { index: number; name: string };

export type AchievementsView = {
  metrics: MemberMetrics;
  items: AchievementItem[];
  byCategory: {
    category: AchievementCategory;
    meta: (typeof CATEGORY_META)[AchievementCategory];
    items: AchievementItem[];
    earnedCount: number;
  }[];
  earnedCount: number;
  totalCount: number;
  rarityCounts: Record<Rarity, number>;
  level: AchievementLevel;
  /** Bijna-behaalde achievements (voortgang > 0 en < 1), aflopend op voortgang. */
  nextUp: AchievementItem[];
  /** Meest recent behaalde achievement. */
  latest: AchievementItem | null;
  /** Mooiste (hoogste rariteit, dan meest recent) behaalde achievement. */
  best: AchievementItem | null;
};

/** Aantal levels — de namen komen uit de `achievements.level`-namespace (0..7). */
const LEVEL_COUNT = 8;

function levelIndexFromEarned(earnedCount: number, total: number): number {
  if (total === 0) return 0;
  const ratio = earnedCount / total;
  return Math.min(LEVEL_COUNT - 1, Math.floor(ratio * (LEVEL_COUNT - 1)));
}

/**
 * Bouwt één weergave-item (behaald/vergrendeld + voortgang + vertaalde labels) uit een
 * definitie, de huidige metricwaarde en de eventuele behaaldatum. Gedeeld door het
 * volledige overzicht ([[getAchievementsView]]) en de "bijna behaald"-lijst
 * ([[nextUpFromMetrics]]) zodat labels/voortgang overal identiek zijn.
 */
function buildAchievementItem(
  def: AchievementDef,
  current: number,
  earnedAt: Date | null,
  tr: AchievementTranslator
): AchievementItem {
  const earned = earnedAt != null;
  return {
    def: { ...def, title: tr.title(def.key), description: tr.description(def.key) },
    earned,
    earnedAt,
    progress: earned ? 1 : progressOf(def, current),
    current,
    currentLabel: tr.metric(def, Math.min(current, def.threshold)),
    targetLabel: tr.metric(def, def.threshold),
    rarityLabel: tr.rarity(def.rarity),
    remaining: Math.max(0, def.threshold - current),
  };
}

/**
 * Volledig weergavemodel voor de achievements van één lid: behaald + vergrendeld
 * + voortgang, gegroepeerd per categorie, met samenvatting/level/nextUp. Verborgen
 * (`hidden`) definities die nog niet behaald zijn worden weggelaten.
 */
export async function getAchievementsView(
  memberId: string,
  tenantId: string
): Promise<AchievementsView> {
  const [metrics, earnedRows] = await Promise.all([
    computeMemberMetrics(memberId, tenantId),
    prisma.earnedAchievement.findMany({
      where: { tenantId, userId: memberId },
      select: { key: true, earnedAt: true },
    }),
  ]);
  // Meerdere rijen per key mogelijk (LOCATION-scope: één per vestiging) —
  // "behaald" zodra minstens één vestiging 'm heeft; de vroegste datum telt.
  const earnedAt = new Map<string, Date>();
  for (const r of earnedRows) {
    const prev = earnedAt.get(r.key);
    if (!prev || r.earnedAt < prev) earnedAt.set(r.key, r.earnedAt);
  }
  const tr = await getAchievementTranslator();

  // LOCATION-defs tonen voortgang op de béste vestiging (org-brede metrics
  // zouden "100% maar vergrendeld" tonen bij spreiding over vestigingen).
  // Afgeleid uit de al-gecachete sessierijen — geen extra queries.
  const locationDefs = ACHIEVEMENTS.filter((d) => scopeOf(d) === "LOCATION");
  const locationCurrent = new Map<string, number>();
  if (locationDefs.length > 0) {
    const sessions = (await loadMemberSessions(memberId, tenantId)).filter(
      (s) => s.endedAt != null
    );
    const byLocation = new Map<string, MemberSessionRow[]>();
    for (const s of sessions) {
      const arr = byLocation.get(s.locationId);
      if (arr) arr.push(s);
      else byLocation.set(s.locationId, [s]);
    }
    const perLocationMetrics = [...byLocation.values()].map((rows) =>
      computeMetrics(rows, null, [], [], 0)
    );
    for (const def of locationDefs) {
      const max = perLocationMetrics.reduce((m, lm) => Math.max(m, lm[def.metric] ?? 0), 0);
      locationCurrent.set(def.key, max);
    }
  }

  const items: AchievementItem[] = [];
  for (const def of ACHIEVEMENTS) {
    const earnedDate = earnedAt.get(def.key) ?? null;
    if (def.hidden && earnedDate == null) continue;
    const current =
      scopeOf(def) === "LOCATION"
        ? locationCurrent.get(def.key) ?? 0
        : metrics[def.metric] ?? 0;
    items.push(buildAchievementItem(def, current, earnedDate, tr));
  }

  const byCategory = CATEGORY_ORDER.map((category) => {
    const catItems = items.filter((i) => i.def.category === category);
    return {
      category,
      meta: { ...CATEGORY_META[category], ...tr.category(category) },
      items: catItems,
      earnedCount: catItems.filter((i) => i.earned).length,
    };
  });

  const earnedItems = items.filter((i) => i.earned);
  const rarityCounts = Object.fromEntries(
    Object.keys(RARITY_META).map((r) => [r, 0])
  ) as Record<Rarity, number>;
  for (const i of earnedItems) rarityCounts[i.def.rarity] += 1;

  const nextUp = items
    .filter((i) => !i.earned && i.progress > 0 && i.progress < 1)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 6);

  const latest = earnedItems
    .filter((i) => i.earnedAt)
    .sort((a, b) => (b.earnedAt!.getTime() - a.earnedAt!.getTime()))[0] ?? null;

  const best =
    [...earnedItems].sort((a, b) => {
      const r = rarityMeta(b.def.rarity).order - rarityMeta(a.def.rarity).order;
      if (r !== 0) return r;
      return (b.earnedAt?.getTime() ?? 0) - (a.earnedAt?.getTime() ?? 0);
    })[0] ?? null;

  return {
    metrics,
    items,
    byCategory,
    earnedCount: earnedItems.length,
    totalCount: ACHIEVEMENTS.filter((d) => !d.hidden).length,
    rarityCounts,
    level: (() => {
      const index = levelIndexFromEarned(earnedItems.length, ACHIEVEMENTS.length);
      return { index, name: tr.level(index) };
    })(),
    nextUp,
    latest,
    best,
  };
}

/**
 * "Bijna behaald"-lijst (nog-vergrendelde, zichtbare achievements met voortgang in
 * (0,1), aflopend op voortgang) rechtstreeks uit metrics + reeds behaalde keys — zónder
 * het volledige [[getAchievementsView]] op te bouwen. Zo berekent de coach-betrokkenheid
 * dit voor veel leden zonder N+1. Identiek aan `getAchievementsView(...).nextUp`.
 */
export function nextUpFromMetrics(
  metrics: MemberMetrics,
  earnedKeys: ReadonlySet<string>,
  tr: AchievementTranslator
): AchievementItem[] {
  const items: AchievementItem[] = [];
  for (const def of ACHIEVEMENTS) {
    if (def.hidden || earnedKeys.has(def.key)) continue; // alleen zichtbare, nog-vergrendelde
    // LOCATION-defs vergen per-vestiging-metrics — het bulk-pad rekent org-breed
    // en zou de voortgang overschatten; bewust overgeslagen in "bijna behaald".
    if (scopeOf(def) === "LOCATION") continue;
    const item = buildAchievementItem(def, metrics[def.metric] ?? 0, null, tr);
    if (item.progress > 0 && item.progress < 1) items.push(item);
  }
  return items.sort((a, b) => b.progress - a.progress).slice(0, 6);
}

// --- UI-zichtbaarheid (opt-in per tenant + opt-out per lid) ------------------

/**
 * Bepaalt of het trofeeën-systeem voor dit lid zichtbaar moet zijn: aan voor de
 * sportschool (`Tenant.achievementsEnabled`) én niet persoonlijk verborgen
 * (`User.preferences.hideAchievements`).
 */
export async function getAchievementUiState(
  memberId: string,
  tenantId: string
): Promise<{ enabled: boolean; hidden: boolean; visible: boolean }> {
  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { achievementsEnabled: true } }),
    prisma.user.findFirst({ where: { id: memberId, tenantId }, select: { preferences: true } }),
  ]);
  const enabled = tenant?.achievementsEnabled ?? false;
  const hidden = getHideAchievements(user?.preferences);
  return { enabled, hidden, visible: enabled && !hidden };
}

// --- Celebration --------------------------------------------------------------

export type PendingCelebration = {
  id: string;
  key: string;
  title: string;
  description: string;
  rarity: Rarity;
  rarityLabel: string;
};

/** Behaalde-maar-nog-niet-gevierde trofeeën van een lid (voor de overlay). */
export async function getPendingCelebrations(
  memberId: string,
  tenantId: string
): Promise<PendingCelebration[]> {
  const rows = await prisma.earnedAchievement.findMany({
    where: { tenantId, userId: memberId, celebratedAt: null },
    orderBy: { earnedAt: "asc" },
    select: { id: true, key: true, rarity: true },
  });
  const tr = await getAchievementTranslator();
  const out: PendingCelebration[] = [];
  for (const r of rows) {
    const def = ACHIEVEMENTS.find((d) => d.key === r.key);
    if (!def) continue;
    out.push({
      id: r.id,
      key: r.key,
      title: tr.title(def.key),
      description: tr.description(def.key),
      rarity: def.rarity,
      rarityLabel: tr.rarity(def.rarity),
    });
  }
  return out;
}

/** Markeer (alle of specifieke) celebrations als getoond. */
export async function markCelebrated(
  memberId: string,
  tenantId: string,
  ids?: string[]
): Promise<void> {
  await prisma.earnedAchievement.updateMany({
    where: {
      tenantId,
      userId: memberId,
      celebratedAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { celebratedAt: new Date() },
  });
}
