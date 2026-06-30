import type { BadgeTone } from "@/components/ui/badge";

/**
 * Centrale, uitbreidbare registry van audit-acties. Eén bron van waarheid voor:
 * - categorie (filters), - label + icoon + kleur (tijdlijn/kleurcodering),
 * - leesbare zin (dashboard-widget).
 *
 * Nieuw event toevoegen = één regel hieronder. Onbekende acties degraderen
 * netjes via `getActionDef` (categorie uit de prefix, generiek label).
 */
export type AuditCategory =
  | "members"
  | "schemas"
  | "exercises"
  | "machines"
  | "tenant"
  | "auth";

export type AuditActionDef = {
  category: AuditCategory;
  label: string;
  icon: string;
  tone: BadgeTone;
  /** Leesbare zin voor de activiteiten-widget. */
  sentence: (ctx: { actor: string; meta: Meta; target?: string | null }) => string;
};

type Meta = Record<string, unknown>;

function s(meta: Meta, key: string): string | undefined {
  const v = meta[key];
  return v == null ? undefined : String(v);
}

export const CATEGORY_META: Record<
  AuditCategory,
  { label: string; icon: string; tone: BadgeTone }
> = {
  members: { label: "Leden", icon: "👥", tone: "accent" },
  schemas: { label: "Schema's", icon: "📋", tone: "success" },
  exercises: { label: "Oefeningen", icon: "🏋️", tone: "warning" },
  machines: { label: "Machines", icon: "⚙️", tone: "neutral" },
  tenant: { label: "Tenant", icon: "🏢", tone: "neutral" },
  auth: { label: "Gebruikers", icon: "🔐", tone: "neutral" },
};

/** Leidt de categorie af uit de action-prefix. */
export function categoryFromAction(action: string): AuditCategory {
  const prefix = action.split(".")[0];
  switch (prefix) {
    case "user":
      return "members";
    case "schema":
      return "schemas";
    case "exercise":
      return "exercises";
    case "machine":
      return "machines";
    case "auth":
      return "auth";
    case "tenant":
    case "branding":
    default:
      return "tenant";
  }
}

export const AUDIT_ACTIONS: Record<string, AuditActionDef> = {
  // --- Leden ---
  "user.create": {
    category: "members", label: "Lid aangemaakt", icon: "➕", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft lid ${s(meta, "email") ?? ""} aangemaakt`.trim(),
  },
  "user.update": {
    category: "members", label: "Lid bijgewerkt", icon: "✏️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft ${s(meta, "name") ?? "een lid"} bijgewerkt`,
  },
  "user.delete": {
    category: "members", label: "Lid verwijderd", icon: "🗑️", tone: "danger",
    sentence: ({ actor }) => `${actor} heeft een lid verwijderd`,
  },
  "user.archive": {
    category: "members", label: "Lid gearchiveerd", icon: "📦", tone: "warning",
    sentence: ({ actor }) => `${actor} heeft een lid gearchiveerd`,
  },
  "user.unarchive": {
    category: "members", label: "Lid hersteld", icon: "♻️", tone: "accent",
    sentence: ({ actor }) => `${actor} heeft een lid hersteld`,
  },
  "user.activate": {
    category: "members", label: "Account geactiveerd", icon: "✅", tone: "success",
    sentence: ({ actor }) => `${actor} heeft een account geactiveerd`,
  },
  "user.deactivate": {
    category: "members", label: "Account gedeactiveerd", icon: "⛔", tone: "warning",
    sentence: ({ actor }) => `${actor} heeft een account gedeactiveerd`,
  },
  "user.role.change": {
    category: "members", label: "Rol gewijzigd", icon: "🔑", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een rol gewijzigd naar ${s(meta, "role") ?? "?"}`,
  },
  "user.import": {
    category: "members", label: "Leden geïmporteerd", icon: "📥", tone: "success",
    sentence: ({ actor, meta }) => {
      const created = s(meta, "created") ?? "0";
      const skipped = s(meta, "skipped");
      return skipped && skipped !== "0"
        ? `${actor} heeft ${created} leden geïmporteerd (${skipped} overgeslagen)`
        : `${actor} heeft ${created} leden geïmporteerd`;
    },
  },
  "user.invite": {
    category: "members", label: "Uitnodiging verzonden", icon: "✉️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft ${s(meta, "email") ?? "iemand"} uitgenodigd`,
  },
  "user.invite.resend": {
    category: "members", label: "Uitnodiging opnieuw verzonden", icon: "🔁", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft de uitnodiging voor ${s(meta, "email") ?? "een lid"} opnieuw verstuurd`,
  },
  "user.invite.revoke": {
    category: "members", label: "Uitnodiging ingetrokken", icon: "🚫", tone: "warning",
    sentence: ({ actor }) => `${actor} heeft een uitnodiging ingetrokken`,
  },
  "user.invite.accept": {
    category: "members", label: "Uitnodiging geaccepteerd", icon: "🎉", tone: "success",
    sentence: ({ actor }) => `${actor} heeft zich geactiveerd`,
  },

  // --- Trainingsschema's ---
  "schema.create": {
    category: "schemas", label: "Schema aangemaakt", icon: "➕", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft schema ${s(meta, "name") ?? ""} aangemaakt`.trim(),
  },
  "schema.update": {
    category: "schemas", label: "Schema gewijzigd", icon: "✏️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft schema ${s(meta, "name") ?? ""} gewijzigd`.trim(),
  },
  "schema.delete": {
    category: "schemas", label: "Schema verwijderd", icon: "🗑️", tone: "danger",
    sentence: ({ actor, meta }) =>
      `${actor} heeft schema ${s(meta, "name") ?? ""} verwijderd`.trim(),
  },
  "schema.duplicate": {
    category: "schemas", label: "Schema gedupliceerd", icon: "📑", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft schema ${s(meta, "name") ?? ""} gedupliceerd`.trim(),
  },
  "schema.assign": {
    category: "schemas", label: "Schema toegewezen", icon: "🎯", tone: "accent",
    sentence: ({ actor, meta }) => {
      const count = s(meta, "memberCount");
      const name = s(meta, "name") ?? "een schema";
      return count
        ? `Schema '${name}' is door ${actor} toegewezen aan ${count} leden`
        : `${actor} heeft schema '${name}' toegewezen`;
    },
  },
  "schema.unassign": {
    category: "schemas", label: "Schema-toewijzing verwijderd", icon: "✖️", tone: "warning",
    sentence: ({ actor }) => `${actor} heeft een schema-toewijzing verwijderd`,
  },
  "schema.pdf.export": {
    category: "schemas", label: "PDF geëxporteerd", icon: "📄", tone: "neutral",
    sentence: ({ actor }) => `${actor} heeft een schema-PDF geëxporteerd`,
  },

  // --- Oefeningen ---
  "exercise.add": {
    category: "exercises", label: "Oefening toegevoegd", icon: "➕", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft oefening ${s(meta, "name") ?? ""} toegevoegd`.trim(),
  },
  "exercise.update": {
    category: "exercises", label: "Oefening gewijzigd", icon: "✏️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft oefening ${s(meta, "name") ?? ""} gewijzigd`.trim(),
  },
  "exercise.remove": {
    category: "exercises", label: "Oefening verwijderd", icon: "🗑️", tone: "danger",
    sentence: ({ actor, meta }) =>
      `${actor} heeft oefening ${s(meta, "name") ?? ""} verwijderd`.trim(),
  },
  "exercise.duplicate": {
    category: "exercises", label: "Oefening gedupliceerd", icon: "📑", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft oefening ${s(meta, "name") ?? ""} gedupliceerd`.trim(),
  },
  "exercise.archive": {
    category: "exercises", label: "Oefening gearchiveerd", icon: "📦", tone: "warning",
    sentence: ({ actor, meta }) =>
      `${actor} heeft oefening ${s(meta, "name") ?? ""} gearchiveerd`.trim(),
  },
  "exercise.unarchive": {
    category: "exercises", label: "Oefening hersteld", icon: "♻️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft oefening ${s(meta, "name") ?? ""} hersteld`.trim(),
  },

  // --- Machines ---
  "machine.create": {
    category: "machines", label: "Machine toegevoegd", icon: "➕", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft machine ${s(meta, "name") ?? ""} toegevoegd`.trim(),
  },
  "machine.update": {
    category: "machines", label: "Machine gewijzigd", icon: "✏️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft machine ${s(meta, "name") ?? ""} gewijzigd`.trim(),
  },
  "machine.delete": {
    category: "machines", label: "Machine verwijderd", icon: "🗑️", tone: "danger",
    sentence: ({ actor, meta }) =>
      `${actor} heeft machine ${s(meta, "name") ?? ""} verwijderd`.trim(),
  },

  // --- Tenant / instellingen ---
  "tenant.settings.update": {
    category: "tenant", label: "Instellingen aangepast", icon: "⚙️", tone: "accent",
    sentence: ({ actor }) => `${actor} heeft de instellingen aangepast`,
  },
  "branding.update": {
    category: "tenant", label: "Huisstijl gewijzigd", icon: "🎨", tone: "accent",
    sentence: ({ actor }) => `${actor} heeft de huisstijl gewijzigd`,
  },
  "tenant.create": {
    category: "tenant", label: "Tenant aangemaakt", icon: "🏢", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft tenant ${s(meta, "name") ?? ""} aangemaakt`.trim(),
  },
  "tenant.update": {
    category: "tenant", label: "Tenant bijgewerkt", icon: "✏️", tone: "accent",
    sentence: ({ actor }) => `${actor} heeft een tenant bijgewerkt`,
  },
  "tenant.activate": {
    category: "tenant", label: "Tenant geactiveerd", icon: "✅", tone: "success",
    sentence: ({ actor }) => `${actor} heeft een tenant geactiveerd`,
  },
  "tenant.deactivate": {
    category: "tenant", label: "Tenant gedeactiveerd", icon: "⛔", tone: "warning",
    sentence: ({ actor }) => `${actor} heeft een tenant gedeactiveerd`,
  },
  "tenant.delete": {
    category: "tenant", label: "Tenant verwijderd", icon: "🗑️", tone: "danger",
    sentence: ({ actor }) => `${actor} heeft een tenant verwijderd`,
  },

  // --- Auth ---
  "auth.login": {
    category: "auth", label: "Ingelogd", icon: "🔓", tone: "neutral",
    sentence: ({ actor }) => `${actor} is ingelogd`,
  },
  "auth.logout": {
    category: "auth", label: "Uitgelogd", icon: "🚪", tone: "neutral",
    sentence: ({ actor }) => `${actor} is uitgelogd`,
  },
  "auth.login.failed": {
    category: "auth", label: "Mislukte inlogpoging", icon: "⚠️", tone: "danger",
    sentence: ({ actor }) => `Mislukte inlogpoging voor ${actor}`,
  },
};

/** Definitie voor een actie, met nette fallback voor onbekende acties. */
export function getActionDef(action: string): AuditActionDef {
  const def = AUDIT_ACTIONS[action];
  if (def) return def;
  const category = categoryFromAction(action);
  return {
    category,
    label: action,
    icon: CATEGORY_META[category].icon,
    tone: "neutral",
    sentence: ({ actor }) => `${actor}: ${action}`,
  };
}

/** Alle acties als filter-opties, gegroepeerd per categorie. */
export function auditActionOptions(): {
  category: AuditCategory;
  action: string;
  label: string;
}[] {
  return Object.entries(AUDIT_ACTIONS).map(([action, def]) => ({
    category: def.category,
    action,
    label: def.label,
  }));
}
