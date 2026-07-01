import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  ACHIEVEMENTS,
  CATEGORY_META,
  CATEGORY_ORDER,
  formatMetricValue,
  progressOf,
  type AchievementCategory,
  type AchievementDef,
} from "@/lib/achievements/definitions";
import { rarityMeta, type Rarity, RARITY_META } from "@/lib/achievements/rarity";
import { computeMemberMetrics, type MemberMetrics } from "@/lib/achievements/metrics";
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
 * de `@@unique([tenantId, userId, key])`-constraint + `skipDuplicates` voorkomen
 * dubbele toekenning, óók bij gelijktijdige evaluaties. Best-effort — een fout
 * mag de onderliggende actie (training afronden, meting toevoegen) nooit breken.
 *
 * @returns de nieuw toegekende definities (voor celebration/UI).
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
        select: { key: true },
      }),
    ]);
    const earnedKeys = new Set(earnedRows.map((r) => r.key));

    const newly: AchievementDef[] = [];
    for (const def of ACHIEVEMENTS) {
      if (earnedKeys.has(def.key)) continue;
      const value = metrics[def.metric] ?? 0;
      if (value >= def.threshold) newly.push(def);
    }
    if (newly.length === 0) return [];

    await prisma.earnedAchievement.createMany({
      data: newly.map((def) => ({
        tenantId,
        userId: memberId,
        key: def.key,
        category: def.category,
        rarity: def.rarity,
        value: metrics[def.metric] ?? 0,
      })),
      skipDuplicates: true,
    });

    // Audit + notificaties (best-effort).
    const user = await prisma.user.findFirst({
      where: { id: memberId, tenantId },
      select: { id: true, email: true, name: true, notificationPrefs: true, active: true },
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

const LEVELS = [
  "Nieuwkomer",
  "Beginner",
  "Doorzetter",
  "Gevorderd",
  "Toegewijd",
  "Expert",
  "Meester",
  "Legende",
];

function levelFromEarned(earnedCount: number, total: number): AchievementLevel {
  if (total === 0) return { index: 0, name: LEVELS[0] };
  const ratio = earnedCount / total;
  const index = Math.min(LEVELS.length - 1, Math.floor(ratio * (LEVELS.length - 1)));
  return { index, name: LEVELS[index] };
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
  const earnedAt = new Map(earnedRows.map((r) => [r.key, r.earnedAt]));

  const items: AchievementItem[] = [];
  for (const def of ACHIEVEMENTS) {
    const earned = earnedAt.has(def.key);
    if (def.hidden && !earned) continue;
    const current = metrics[def.metric] ?? 0;
    const progress = earned ? 1 : progressOf(def, current);
    items.push({
      def,
      earned,
      earnedAt: earnedAt.get(def.key) ?? null,
      progress,
      current,
      currentLabel: formatMetricValue(def, Math.min(current, def.threshold)),
      targetLabel: formatMetricValue(def, def.threshold),
      remaining: Math.max(0, def.threshold - current),
    });
  }

  const byCategory = CATEGORY_ORDER.map((category) => {
    const catItems = items.filter((i) => i.def.category === category);
    return {
      category,
      meta: CATEGORY_META[category],
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
    level: levelFromEarned(earnedItems.length, ACHIEVEMENTS.length),
    nextUp,
    latest,
    best,
  };
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
  const out: PendingCelebration[] = [];
  for (const r of rows) {
    const def = ACHIEVEMENTS.find((d) => d.key === r.key);
    if (!def) continue;
    out.push({
      id: r.id,
      key: r.key,
      title: def.title,
      description: def.description,
      rarity: def.rarity,
      rarityLabel: rarityMeta(def.rarity).label,
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
