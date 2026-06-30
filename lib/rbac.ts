// Pure RBAC-helpers (geen Prisma/server-only import) zodat dit ook in Client
// Components bruikbaar is. Permissies zijn code-gedefinieerd: de rol levert de
// *defaults*, per-medewerker kan de eigenaar ze aan/uit zetten (override).
// Later eenvoudig naar een DB-backed model te tillen zonder de call-sites te wijzigen.
import type { Role } from "@prisma/client";

export type Permission =
  // --- Platform/beheer (superadmin / tenant-admin) ---
  | "tenant:manage" // tenants aanmaken/wijzigen/(de)activeren/verwijderen
  | "branding:manage" // huisstijl per tenant beheren
  | "user:invite" // gebruikers uitnodigen
  | "user:manage" // leden toevoegen/bewerken/verwijderen/(de)activeren
  | "role:assign" // rollen + medewerker-rechten wijzigen
  | "audit:read" // audit log inzien
  // --- Tenant-feature (toewijsbaar aan een medewerker) ---
  | "schemas:manage" // trainingsschema's maken/bewerken/toewijzen
  | "members:view" // leden bekijken/zoeken/profiel/historie
  | "measurements:manage" // metingen registreren
  | "coachnotes:manage" // coachnotities toevoegen/bewerken
  | "members:assign-self" // zichzelf als coach aan leden koppelen (standaard uit)
  | "schedule:manage" // rooster/groepslessen beheren
  | "exercises:manage" // eigen oefeningen beheren
  | "members:import" // leden importeren (standaard uit)
  | "reports:export" // rapportages exporteren (standaard uit)
  | "mailings:send"; // mailings versturen (standaard uit)

/**
 * De feature-permissies die een eigenaar per medewerker kan aan/uit zetten.
 * Beheer-permissies (tenant/branding/user/role/audit) zijn NOOIT toewijsbaar aan
 * een medewerker — die blijven exclusief voor de eigenaar/superadmin.
 */
export const STAFF_CONFIGURABLE_PERMISSIONS = [
  "schemas:manage",
  "members:view",
  "measurements:manage",
  "coachnotes:manage",
  "members:assign-self",
  "schedule:manage",
  "exercises:manage",
  "members:import",
  "reports:export",
  "mailings:send",
] as const satisfies readonly Permission[];

/** Standaard-AAN voor een nieuwe medewerker (de dagelijkse coach-taken). */
const STAFF_DEFAULT_ON: readonly Permission[] = [
  "schemas:manage",
  "members:view",
  "measurements:manage",
  "coachnotes:manage",
  "schedule:manage",
  "exercises:manage",
];

const TENANT_ADMIN_PERMISSIONS: Permission[] = [
  "user:invite",
  "user:manage",
  "role:assign",
  "audit:read",
  ...STAFF_CONFIGURABLE_PERMISSIONS,
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: [
    "tenant:manage",
    "branding:manage",
    ...TENANT_ADMIN_PERMISSIONS,
  ],
  // Tenant-admin: alle gebruikers- én feature-beheer binnen de EIGEN tenant
  // (afgedwongen via assertTenantAccess). Geen tenant-/branding-beheer (superadmin).
  TENANT_ADMIN: TENANT_ADMIN_PERMISSIONS,
  // Medewerker: dagelijkse coach-taken aan; gevoelige extra's standaard uit.
  TENANT_STAFF: [...STAFF_DEFAULT_ON],
  TENANT_MEMBER: [],
};

/** Per-medewerker afwijking op de role-default. null/undefined = volledig role-default. */
export type PermissionOverrides = Partial<Record<Permission, boolean>>;

/**
 * De effectieve permissies voor een gebruiker. Admin/superadmin krijgen altijd hun
 * volledige set (overrides genegeerd — admin is een superset). Voor een medewerker
 * start de role-default en passen we per *toewijsbare* permissie de override toe.
 */
export function getEffectivePermissions(
  role: Role,
  overrides?: PermissionOverrides | null
): Set<Permission> {
  const base = new Set<Permission>(ROLE_PERMISSIONS[role] ?? []);
  if (role !== "TENANT_STAFF" || !overrides) return base;
  for (const perm of STAFF_CONFIGURABLE_PERMISSIONS) {
    const value = overrides[perm];
    if (value === true) base.add(perm);
    else if (value === false) base.delete(perm);
  }
  return base;
}

/** Heeft deze gebruiker (rol + overrides) de gevraagde permissie? */
export function hasPermission(
  user: { role: Role; permissions?: PermissionOverrides | null },
  permission: Permission
): boolean {
  return getEffectivePermissions(user.role, user.permissions).has(permission);
}

/** Pure role-permissie-check (zonder overrides). */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// --- Permissie-catalogus voor de beheer-UI (matrix) -------------------------

export type PermissionMeta = {
  permission: Permission;
  label: string;
  description: string;
};

export type PermissionGroup = {
  key: string;
  label: string;
  permissions: PermissionMeta[];
};

/** Gegroepeerde, toewijsbare permissies — voedt de medewerker-rechtenmatrix. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "schemas",
    label: "Trainingsschema's",
    permissions: [
      {
        permission: "schemas:manage",
        label: "Trainingsschema's beheren",
        description: "Schema's maken, bewerken, toewijzen en concepten opslaan.",
      },
    ],
  },
  {
    key: "members",
    label: "Leden",
    permissions: [
      {
        permission: "members:view",
        label: "Leden bekijken",
        description: "Ledenprofielen, zoeken en trainingshistorie inzien.",
      },
      {
        permission: "measurements:manage",
        label: "Metingen registreren",
        description: "Metingen vastleggen en de voortgang van leden bijhouden.",
      },
      {
        permission: "coachnotes:manage",
        label: "Coachnotities beheren",
        description: "Coachnotities toevoegen en bewerken op het ledenprofiel.",
      },
      {
        permission: "members:assign-self",
        label: "Zichzelf leden toewijzen",
        description: "Mag zichzelf als coach aan leden koppelen en loskoppelen (standaard uit).",
      },
    ],
  },
  {
    key: "schedule",
    label: "Planning",
    permissions: [
      {
        permission: "schedule:manage",
        label: "Planning beheren",
        description: "Lessen toevoegen/wijzigen, trainers plannen, capaciteit aanpassen.",
      },
    ],
  },
  {
    key: "exercises",
    label: "Oefeningen",
    permissions: [
      {
        permission: "exercises:manage",
        label: "Eigen oefeningen beheren",
        description: "Eigen oefeningen toevoegen, wijzigen en gebruiken in schema's.",
      },
    ],
  },
  {
    key: "extra",
    label: "Extra (standaard uit)",
    permissions: [
      {
        permission: "members:import",
        label: "Leden importeren",
        description: "Leden in bulk importeren via een bestand.",
      },
      {
        permission: "reports:export",
        label: "Rapportages exporteren",
        description: "Statistieken en rapportages exporteren.",
      },
      {
        permission: "mailings:send",
        label: "Mailings versturen",
        description: "Berichten/mailings naar leden versturen.",
      },
    ],
  },
];

export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Dwingt tenant-toegang af bij elke beheeractie. SUPERADMIN mag cross-tenant;
 * iedereen anders uitsluitend binnen de eigen tenant.
 */
export function assertTenantAccess(
  user: { role: Role; tenantId: string | null },
  tenantId: string
): void {
  if (user.role === "SUPERADMIN") return;
  if (user.tenantId !== tenantId) throw new ForbiddenError();
}
