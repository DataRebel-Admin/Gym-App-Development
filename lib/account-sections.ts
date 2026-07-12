import type { Role } from "@prisma/client";

/**
 * Eén bron van waarheid voor de accountsectie-navigatie: de hub-lijst (mobiel),
 * de zijbalk (desktop) én de dynamische titel in de topbalk lezen allemaal deze
 * structuur. Puur (géén `t`): we dragen i18n-**keys** zodat de server-layout ze
 * resolvet en geserialiseerde strings doorgeeft aan de client-componenten.
 *
 * Nieuwe sectie = één regel hier (+ evt. een icoon + i18n-key). Idioom zoals de
 * andere code-registries (exercise-types, audit-actions).
 */

export const ACCOUNT_ICON = {
  overview: "M4 5a1 1 0 0 1 1-1h5v6H4V5ZM14 4h5a1 1 0 0 1 1 1v3h-6V4ZM14 12h6v7a1 1 0 0 1-1 1h-5v-8ZM4 12h6v8H5a1 1 0 0 1-1-1v-7Z",
  profile: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  privacy: "M12 2 4 5v6c0 5 8 11 8 11s8-6 8-11V5l-8-3ZM9 12l2 2 4-4",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  building: "M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M19 21V9h1M9 8h2M9 12h2M9 16h2",
  plug: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
} as const;

export type AccountIconKey = keyof typeof ACCOUNT_ICON;

/** Rauwe sectie-item: alle labels als i18n-keys relatief aan de `account`-namespace. */
export type RawAccountItem = {
  href: string;
  labelKey: string;
  descKey: string;
  icon: AccountIconKey;
};

export type RawAccountGroup = {
  key: string;
  labelKey: string;
  items: RawAccountItem[];
};

/** Rol-bewuste, gegroepeerde sectiestructuur (nog niet vertaald). */
export function accountSectionsRaw(role: Role): RawAccountGroup[] {
  const isMember = role === "TENANT_MEMBER";
  const isAdmin = role === "TENANT_ADMIN";

  const account: RawAccountItem[] = [
    { href: "/account/profiel", labelKey: "nav.profile", descKey: "hub.subtitles.profile", icon: "profile" },
  ];
  if (isMember) {
    account.push({ href: "/account/doelen", labelKey: "nav.goals", descKey: "hub.subtitles.goals", icon: "target" });
  }
  account.push({ href: "/account/taal", labelKey: "language.navLabel", descKey: "hub.subtitles.language", icon: "globe" });

  const groups: RawAccountGroup[] = [
    { key: "account", labelKey: "hub.groups.account", items: account },
    {
      key: "prefs",
      labelKey: "hub.groups.prefs",
      items: [
        { href: "/account/meldingen", labelKey: "nav.notifications", descKey: "hub.subtitles.notifications", icon: "bell" },
      ],
    },
    {
      key: "security",
      labelKey: "hub.groups.security",
      items: [
        { href: "/account/beveiliging", labelKey: "nav.security", descKey: "hub.subtitles.security", icon: "shield" },
        { href: "/account/privacy", labelKey: "nav.privacy", descKey: "hub.subtitles.privacy", icon: "privacy" },
        { href: "/account/integraties", labelKey: "nav.integrations", descKey: "hub.subtitles.integrations", icon: "plug" },
        { href: "/account/activiteit", labelKey: "nav.activity", descKey: "hub.subtitles.activity", icon: "activity" },
      ],
    },
  ];

  if (isAdmin) {
    groups.push({
      key: "admin",
      labelKey: "hub.groups.admin",
      items: [
        { href: "/account/tenant", labelKey: "nav.gym", descKey: "hub.subtitles.gym", icon: "building" },
      ],
    });
  }

  return groups;
}

/** Dashboard-terugpad per rol (topbalk "terug" op de hub-root). */
export function dashboardHrefFor(role: Role): string {
  return role === "SUPERADMIN" ? "/admin" : role === "TENANT_ADMIN" ? "/owner" : "/member";
}

// --- Opgeloste (vertaalde) vormen die de componenten ontvangen ---

/** Één sectie-item met opgeloste labels + inline SVG-pad. */
export type AccountItem = {
  href: string;
  label: string;
  desc: string;
  iconPath: string;
};

export type AccountGroup = {
  key: string;
  label: string;
  items: AccountItem[];
};

/** Platte lijst voor de zijbalk + topbalk-titellookup (met "Overzicht" vooraan). */
export type AccountFlatItem = { href: string; label: string; iconPath: string };
