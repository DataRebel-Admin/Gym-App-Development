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
  | "measurements"
  | "engagement"
  | "tenant"
  | "email"
  | "support"
  | "platform"
  | "features"
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
  measurements: { label: "Metingen", icon: "📏", tone: "accent" },
  engagement: { label: "Betrokkenheid", icon: "🏆", tone: "success" },
  tenant: { label: "Tenant", icon: "🏢", tone: "neutral" },
  email: { label: "E-mailtemplates", icon: "✉️", tone: "accent" },
  support: { label: "Support", icon: "🛟", tone: "accent" },
  platform: { label: "Platform", icon: "🛠️", tone: "neutral" },
  features: { label: "Features", icon: "🧩", tone: "accent" },
  auth: { label: "Gebruikers", icon: "🔐", tone: "neutral" },
};

/** Leidt de categorie af uit de action-prefix. */
export function categoryFromAction(action: string): AuditCategory {
  const prefix = action.split(".")[0];
  switch (prefix) {
    case "user":
    case "coachnote":
    case "coach":
      return "members";
    case "schema":
    case "request":
      return "schemas";
    case "exercise":
      return "exercises";
    case "machine":
      return "machines";
    case "measurement":
    case "goal":
      return "measurements";
    case "achievement":
    case "milestone":
    case "passport":
      return "engagement";
    case "auth":
      return "auth";
    case "email":
      return "email";
    case "support":
      return "support";
    case "platform":
      return "platform";
    case "feature":
      return "features";
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
  "user.activate.opened": {
    category: "members", label: "Activatielink geopend", icon: "👀", tone: "neutral",
    sentence: ({ meta }) => `${s(meta, "email") ?? "Iemand"} heeft de activatielink geopend`,
  },
  "user.activate.expired": {
    category: "members", label: "Activatielink verlopen", icon: "⌛", tone: "warning",
    sentence: ({ meta }) => `Een activatielink voor ${s(meta, "email") ?? "een lid"} was verlopen`,
  },
  "user.activate.resend": {
    category: "members", label: "Nieuwe activatielink verstuurd", icon: "📨", tone: "accent",
    sentence: ({ meta }) => `Een nieuwe activatielink is verstuurd naar ${s(meta, "email") ?? "een lid"}`,
  },
  "user.password.set": {
    category: "members", label: "Wachtwoord ingesteld", icon: "🔐", tone: "success",
    sentence: ({ actor }) => `${actor} heeft bij activatie een wachtwoord ingesteld`,
  },
  "user.permissions.change": {
    category: "members", label: "Rechten aangepast", icon: "🛡️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft de rechten van ${s(meta, "email") ?? "een medewerker"} aangepast`,
  },

  // --- Coachnotities ---
  "coachnote.add": {
    category: "members", label: "Coachnotitie toegevoegd", icon: "📝", tone: "success",
    sentence: ({ actor }) => `${actor} heeft een coachnotitie toegevoegd`,
  },
  "coachnote.update": {
    category: "members", label: "Coachnotitie bijgewerkt", icon: "✏️", tone: "accent",
    sentence: ({ actor }) => `${actor} heeft een coachnotitie bijgewerkt`,
  },
  "coachnote.delete": {
    category: "members", label: "Coachnotitie verwijderd", icon: "🗑️", tone: "danger",
    sentence: ({ actor }) => `${actor} heeft een coachnotitie verwijderd`,
  },
  "coach.assign": {
    category: "members", label: "Coach toegewezen", icon: "🤝", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft ${s(meta, "member") ?? "een lid"} aan een coach toegewezen`,
  },
  "coach.unassign": {
    category: "members", label: "Coach-koppeling verwijderd", icon: "✂️", tone: "warning",
    sentence: ({ actor }) => `${actor} heeft een coach-koppeling verwijderd`,
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
  "schema.reassign": {
    category: "schemas", label: "Schema opnieuw toegewezen", icon: "🔄", tone: "accent",
    sentence: ({ actor, meta }) => {
      const count = s(meta, "memberCount");
      const name = s(meta, "name") ?? "een schema";
      return count && count !== "1"
        ? `${actor} heeft schema '${name}' opnieuw toegewezen aan ${count} leden`
        : `${actor} heeft schema '${name}' opnieuw toegewezen`;
    },
  },
  "schema.publish": {
    category: "schemas", label: "Schema gepubliceerd", icon: "🚀", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft schema '${s(meta, "name") ?? ""}' gepubliceerd`.trim(),
  },
  "schema.schedule": {
    category: "schemas", label: "Schema ingepland", icon: "🕒", tone: "neutral",
    sentence: ({ actor, meta }) => {
      const name = s(meta, "name") ?? "een schema";
      const when = s(meta, "availableFrom");
      return when
        ? `${actor} heeft schema '${name}' ingepland voor ${when}`
        : `${actor} heeft schema '${name}' ingepland`;
    },
  },
  "schema.archive": {
    category: "schemas", label: "Schema gearchiveerd", icon: "📦", tone: "warning",
    sentence: ({ actor, meta }) =>
      `${actor} heeft schema-toewijzing '${s(meta, "name") ?? ""}' gearchiveerd`.trim(),
  },
  "schema.unassign": {
    category: "schemas", label: "Schema-toewijzing verwijderd", icon: "✖️", tone: "warning",
    sentence: ({ actor }) => `${actor} heeft een schema-toewijzing verwijderd`,
  },
  "schema.notify.sent": {
    category: "schemas", label: "Notificatie verzonden", icon: "🔔", tone: "neutral",
    sentence: ({ meta }) =>
      `Melding over '${s(meta, "name") ?? "een schema"}' verzonden aan ${s(meta, "member") ?? "een lid"}`,
  },
  "schema.email.sent": {
    category: "schemas", label: "E-mail verzonden", icon: "📧", tone: "neutral",
    sentence: ({ meta }) =>
      `E-mail over '${s(meta, "name") ?? "een schema"}' verzonden aan ${s(meta, "to") ?? "een lid"}`,
  },
  "session.conduct.start": {
    category: "members", label: "PT-sessie gestart", icon: "▶️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} startte een training voor ${s(meta, "member") ?? "een lid"}`,
  },
  "session.conduct.complete": {
    category: "members", label: "PT-sessie afgerond", icon: "✅", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} rondde een training af voor ${s(meta, "member") ?? "een lid"}`,
  },
  "session.conduct.cancel": {
    category: "members", label: "PT-sessie geannuleerd", icon: "✖️", tone: "warning",
    sentence: ({ actor, meta }) =>
      `${actor} annuleerde een training voor ${s(meta, "member") ?? "een lid"}`,
  },
  "schema.pdf.export": {
    category: "schemas", label: "PDF geëxporteerd", icon: "📄", tone: "neutral",
    sentence: ({ actor }) => `${actor} heeft een schema-PDF geëxporteerd`,
  },
  "schema.sync": {
    category: "schemas", label: "Schema gesynchroniseerd", icon: "🔃", tone: "accent",
    sentence: ({ actor, meta }) => {
      const name = s(meta, "name") ?? "een schema";
      const mode = s(meta, "mode");
      const label =
        mode === "all"
          ? "alle master-wijzigingen overgenomen"
          : mode === "dismiss"
            ? "master-wijzigingen genegeerd"
            : "een master-wijziging overgenomen";
      return `${actor} heeft voor '${name}' ${label}`;
    },
  },
  "schema.bulk.edit": {
    category: "schemas", label: "Bulkwijziging toegepast", icon: "⚡", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een bulkwijziging toegepast op ${s(meta, "memberCount") ?? "meerdere"} leden`,
  },
  "schema.master.apply": {
    category: "schemas", label: "Wijziging in master toegepast", icon: "⬆️", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een veelvoorkomende aanpassing in master '${s(meta, "name") ?? ""}' toegepast`.trim(),
  },

  // --- Zelf-gebouwde lid-schema's (sporter bouwt zelf) ---
  "schema.member.start": {
    category: "schemas", label: "Zelf schema gestart", icon: "🧩", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} is zelf een trainingsschema '${s(meta, "name") ?? ""}' gaan samenstellen`.trim(),
  },
  "schema.member.submit": {
    category: "schemas", label: "Zelf-schema ingediend", icon: "📨", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft zelf-schema '${s(meta, "name") ?? ""}' ingediend ter controle`.trim(),
  },
  "schema.member.approve": {
    category: "schemas", label: "Zelf-schema goedgekeurd", icon: "✅", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft het zelf-gebouwde schema van ${s(meta, "member") ?? "een lid"} goedgekeurd`,
  },
  "schema.member.reject": {
    category: "schemas", label: "Zelf-schema afgewezen", icon: "🚫", tone: "danger",
    sentence: ({ actor, meta }) =>
      `${actor} heeft het zelf-gebouwde schema van ${s(meta, "member") ?? "een lid"} afgewezen`,
  },
  "schema.member.activate": {
    category: "schemas", label: "Zelf-schema geactiveerd", icon: "🚀", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft zelf-schema '${s(meta, "name") ?? ""}' geactiveerd`.trim(),
  },
  "schema.member.pause": {
    category: "schemas", label: "Zelf-schema gepauzeerd", icon: "⏸️", tone: "warning",
    sentence: ({ actor, meta }) =>
      `${actor} heeft zelf-schema '${s(meta, "name") ?? ""}' gepauzeerd`.trim(),
  },
  "schema.framework.save": {
    category: "schemas", label: "Kader opgeslagen", icon: "🧭", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft kader '${s(meta, "name") ?? ""}' voor zelf-schema's opgeslagen`.trim(),
  },
  "schema.framework.delete": {
    category: "schemas", label: "Kader verwijderd", icon: "🗑️", tone: "danger",
    sentence: ({ actor, meta }) =>
      `${actor} heeft kader '${s(meta, "name") ?? ""}' verwijderd`.trim(),
  },
  "schema.framework.assign": {
    category: "schemas", label: "Kader gekoppeld aan lid", icon: "🔗", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een kader gekoppeld aan ${s(meta, "member") ?? "een lid"}`,
  },

  // --- Schema-aanvragen (sporter → coach) ---
  "request.submit": {
    category: "schemas", label: "Schema-aanvraag ingediend", icon: "📨", tone: "accent",
    sentence: ({ meta }) =>
      `${s(meta, "member") ?? "Een lid"} heeft een nieuw trainingsschema aangevraagd`,
  },
  "request.status.change": {
    category: "schemas", label: "Aanvraagstatus gewijzigd", icon: "🔁", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een schema-aanvraag op '${s(meta, "status") ?? "?"}' gezet`,
  },
  "request.schema.link": {
    category: "schemas", label: "Aanvraag gekoppeld aan schema", icon: "🔗", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een schema-aanvraag van ${s(meta, "member") ?? "een lid"} afgerond met een schema`,
  },
  "request.cancel": {
    category: "schemas", label: "Schema-aanvraag geannuleerd", icon: "✖️", tone: "warning",
    sentence: ({ actor }) => `${actor} heeft een schema-aanvraag geannuleerd`,
  },

  // --- Oefeningen ---
  "exercise.add": {
    category: "exercises", label: "Oefening toegevoegd", icon: "➕", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft oefening ${s(meta, "name") ?? ""} toegevoegd`.trim(),
  },
  "exercise.import": {
    category: "exercises", label: "Oefeningen toegevoegd uit catalogus", icon: "📦", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft ${s(meta, "count") ?? "0"} oefeningen toegevoegd uit de catalogus`,
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
  "exercise.type.change": {
    category: "exercises", label: "Oefeningstype gewijzigd", icon: "🏷️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft het type van oefening ${s(meta, "name") ?? ""} gewijzigd naar ${s(meta, "type") ?? "?"}`.trim(),
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
  "machine.qr.export": {
    category: "machines", label: "QR-codes geëxporteerd", icon: "🏷️", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft ${s(meta, "count") ?? "0"} QR-code(s) geëxporteerd${
        s(meta, "format") ? ` (${s(meta, "format")})` : ""
      }`,
  },

  // --- Machine-onderhoud ---
  "machine.maintenance.rule": {
    category: "machines", label: "Onderhoudsregels ingesteld", icon: "⚙️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft de onderhoudsregels van ${s(meta, "name") ?? "een machine"} ingesteld`,
  },
  "machine.maintenance.policy": {
    category: "machines", label: "Standaard onderhoudsregels", icon: "🧭", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft standaard onderhoudsregels voor type ${s(meta, "type") ?? "?"} ingesteld`,
  },
  "machine.maintenance.performed": {
    category: "machines", label: "Onderhoud uitgevoerd", icon: "🔧", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft onderhoud uitgevoerd aan ${s(meta, "name") ?? "een machine"}`,
  },
  "machine.maintenance.due": {
    category: "machines", label: "Onderhoud nu nodig", icon: "🚨", tone: "danger",
    sentence: ({ meta }) =>
      `${s(meta, "name") ?? "Een machine"} heeft nu onderhoud nodig`,
  },
  "machine.maintenance.warn": {
    category: "machines", label: "Onderhoud bijna nodig", icon: "⚠️", tone: "warning",
    sentence: ({ meta }) =>
      `${s(meta, "name") ?? "Een machine"} heeft binnenkort onderhoud nodig`,
  },
  "machine.maintenance.notify.sent": {
    category: "machines", label: "Onderhoudsmelding verzonden", icon: "🔔", tone: "neutral",
    sentence: ({ meta }) =>
      `Onderhoudsmelding over ${s(meta, "name") ?? "een machine"} verzonden`,
  },
  "machine.status.change": {
    category: "machines", label: "Machinestatus gewijzigd", icon: "🔄", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft ${s(meta, "name") ?? "een machine"} op '${s(meta, "status") ?? "?"}' gezet`,
  },
  "machine.usage.adjust": {
    category: "machines", label: "Gebruiksteller aangepast", icon: "🔢", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft de gebruiksteller van ${s(meta, "name") ?? "een machine"} aangepast`,
  },

  // --- Metingen (Body Composition) ---
  "measurement.add": {
    category: "measurements", label: "Meting toegevoegd", icon: "📏", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een meting toegevoegd${s(meta, "member") ? ` voor ${s(meta, "member")}` : ""}`,
  },
  "measurement.update": {
    category: "measurements", label: "Meting gewijzigd", icon: "✏️", tone: "accent",
    sentence: ({ actor }) => `${actor} heeft een meting gewijzigd`,
  },
  "measurement.remove": {
    category: "measurements", label: "Meting verwijderd", icon: "🗑️", tone: "danger",
    sentence: ({ actor }) => `${actor} heeft een meting verwijderd`,
  },
  "measurement.report.export": {
    category: "measurements", label: "Voortgangsrapport geëxporteerd", icon: "📄", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een voortgangsrapport geëxporteerd${s(meta, "member") ? ` van ${s(meta, "member")}` : ""}`,
  },
  "goal.set": {
    category: "measurements", label: "Doel ingesteld", icon: "🎯", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een doel ingesteld${s(meta, "metric") ? ` (${s(meta, "metric")})` : ""}`,
  },
  "goal.remove": {
    category: "measurements", label: "Doel verwijderd", icon: "✖️", tone: "warning",
    sentence: ({ actor }) => `${actor} heeft een doel verwijderd`,
  },

  // --- Trofeeën / achievements / mijlpalen ---
  "achievement.earned": {
    category: "engagement", label: "Achievement behaald", icon: "🏆", tone: "success",
    sentence: ({ actor, meta }) =>
      `${s(meta, "member") ?? actor} heeft de trofee '${s(meta, "name") ?? ""}' behaald`.trim(),
  },
  "achievement.notify.sent": {
    category: "engagement", label: "Achievement-melding verzonden", icon: "🔔", tone: "neutral",
    sentence: ({ meta }) =>
      `Melding over trofee '${s(meta, "name") ?? "een achievement"}' verzonden aan ${s(meta, "member") ?? "een lid"}`,
  },
  "milestone.reached": {
    category: "engagement", label: "Mijlpaal bereikt", icon: "🎯", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${s(meta, "member") ?? actor} heeft een mijlpaal bereikt: ${s(meta, "name") ?? ""}`.trim(),
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

  // --- E-mailtemplates (Superadmin) ---
  "email.template.update": {
    category: "email", label: "Template-concept opgeslagen", icon: "✏️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft het concept van template '${s(meta, "name") ?? s(meta, "key") ?? ""}' opgeslagen`.trim(),
  },
  "email.template.publish": {
    category: "email", label: "Template gepubliceerd", icon: "🚀", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft template '${s(meta, "name") ?? s(meta, "key") ?? ""}' gepubliceerd`.trim(),
  },
  "email.template.restore": {
    category: "email", label: "Versie hersteld", icon: "↩️", tone: "warning",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een eerdere versie van '${s(meta, "name") ?? s(meta, "key") ?? ""}' hersteld`.trim(),
  },
  "email.template.reset": {
    category: "email", label: "Standaard hersteld", icon: "♻️", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft template '${s(meta, "name") ?? s(meta, "key") ?? ""}' teruggezet naar de standaard`.trim(),
  },
  "email.test.send": {
    category: "email", label: "Testmail verzonden", icon: "📨", tone: "neutral",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een testmail '${s(meta, "name") ?? s(meta, "key") ?? ""}' verstuurd naar ${s(meta, "to") ?? "een adres"}`,
  },

  // --- Support (contact opnemen) ---
  "support.open": {
    category: "support", label: "Contactformulier geopend", icon: "🛟", tone: "neutral",
    sentence: ({ actor }) => `${actor} heeft het contactformulier geopend`,
  },
  "support.send": {
    category: "support", label: "Supportbericht verzonden", icon: "📨", tone: "success",
    sentence: ({ actor, meta }) =>
      `${actor} heeft een supportbericht verzonden${s(meta, "subject") ? `: '${s(meta, "subject")}'` : ""}`,
  },

  // --- Feature flags (Superadmin) ---
  "feature.toggle": {
    category: "features", label: "Feature gewijzigd", icon: "🧩", tone: "accent",
    sentence: ({ actor, meta }) => {
      const name = s(meta, "name") ?? s(meta, "feature") ?? "een feature";
      const on = s(meta, "enabled") === "true";
      return `${actor} heeft feature '${name}' ${on ? "ingeschakeld" : "uitgeschakeld"}`;
    },
  },

  // --- Platform-instellingen (Superadmin) ---
  "platform.settings.update": {
    category: "platform", label: "Platforminstelling aangepast", icon: "🛠️", tone: "accent",
    sentence: ({ actor, meta }) =>
      `${actor} heeft de platforminstelling '${s(meta, "setting") ?? ""}' aangepast`.trim(),
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
