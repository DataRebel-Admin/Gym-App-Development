import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import type { Role } from "@prisma/client";
import {
  type FeatureKey,
  FEATURES,
  FEATURE_KEYS,
  defaultFeatureFlags,
  isFeatureKey,
} from "./catalog";

/**
 * Centrale feature-flag-service. Dé plek waar zowel de UI als de server bepalen
 * of een module actief is voor een tenant — nooit hardgecodeerde controles
 * verspreid door de code. Leest per request (React `cache`) de `FeatureFlag`-
 * rijen en legt ze over de code-defaults; muteren gaat uitsluitend via de
 * Superadmin (`setFeatureFlag`, met audit).
 *
 * Gebruikt bewust de base `prisma` met expliciete `tenantId`-filter (zoals
 * `getCurrentTenant`/`member-stats`) — de resolutie draait ook in contexten
 * zonder tenant-DB-context. RLS is de backstop.
 */

export type FeatureFlagRow = {
  key: FeatureKey;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  /** `true` als de waarde uit de DB komt; `false` = code-default (nooit gewijzigd). */
  overridden: boolean;
  updatedAt: string | null;
  updatedByEmail: string | null;
};

/** Effectieve feature-flags voor een tenant (code-defaults + DB-overrides). */
export const getTenantFeatures = cache(
  async (tenantId: string): Promise<Record<FeatureKey, boolean>> => {
    const flags = defaultFeatureFlags();
    const rows = await prisma.featureFlag.findMany({
      where: { tenantId },
      select: { key: true, enabled: true },
    });
    for (const row of rows) {
      if (isFeatureKey(row.key)) flags[row.key] = row.enabled;
    }
    return flags;
  }
);

/** Staat één feature aan voor deze tenant? */
export async function isFeatureEnabled(
  tenantId: string,
  key: FeatureKey
): Promise<boolean> {
  const flags = await getTenantFeatures(tenantId);
  return flags[key];
}

/** Effectieve feature-flags voor de tenant van de huidige request. */
export async function getCurrentTenantFeatures(): Promise<
  Record<FeatureKey, boolean>
> {
  const tenant = await getCurrentTenant();
  if (!tenant) return defaultFeatureFlags();
  return getTenantFeatures(tenant.id);
}

/**
 * Guard voor pagina's/actions: 404 als de feature uit staat. Zo is een
 * uitgeschakelde module ook niet bereikbaar via een directe URL of API-aanroep.
 */
export async function requireFeature(
  tenantId: string,
  key: FeatureKey
): Promise<void> {
  if (!(await isFeatureEnabled(tenantId, key))) notFound();
}

/** Beheer-weergave: alle features met status + laatste-wijziging-metadata. */
export async function getFeatureFlagRows(
  tenantId: string
): Promise<FeatureFlagRow[]> {
  const rows = await prisma.featureFlag.findMany({
    where: { tenantId },
    select: { key: true, enabled: true, updatedAt: true, updatedByEmail: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return FEATURE_KEYS.map((key) => {
    const def = FEATURES[key];
    const row = byKey.get(key);
    return {
      key,
      name: def.name,
      description: def.description,
      icon: def.icon,
      enabled: row ? row.enabled : def.defaultEnabled,
      overridden: Boolean(row),
      updatedAt: row ? row.updatedAt.toISOString() : null,
      updatedByEmail: row?.updatedByEmail ?? null,
    };
  });
}

/**
 * Zet een feature aan/uit voor een tenant (upsert) en logt de wijziging. Alléén
 * aanroepen achter `requireSuperadmin()`. Wijzigingen zijn direct actief (de
 * per-request cache leeft maar één request).
 */
export async function setFeatureFlag(
  tenantId: string,
  key: FeatureKey,
  enabled: boolean,
  actor: { id?: string | null; email?: string | null; role?: Role | null }
): Promise<void> {
  const existing = await prisma.featureFlag.findUnique({
    where: { tenantId_key: { tenantId, key } },
    select: { enabled: true },
  });
  const previous = existing ? existing.enabled : FEATURES[key].defaultEnabled;

  await prisma.featureFlag.upsert({
    where: { tenantId_key: { tenantId, key } },
    update: { enabled, updatedById: actor.id ?? null, updatedByEmail: actor.email ?? null },
    create: {
      tenantId,
      key,
      enabled,
      updatedById: actor.id ?? null,
      updatedByEmail: actor.email ?? null,
    },
  });

  if (previous === enabled) return; // geen echte wijziging → niet loggen

  await audit("feature.toggle", {
    actor,
    tenantId,
    targetType: "FeatureFlag",
    targetId: key,
    oldValue: { enabled: previous },
    newValue: { enabled },
    metadata: { feature: key, name: FEATURES[key].name, enabled },
  });
}
