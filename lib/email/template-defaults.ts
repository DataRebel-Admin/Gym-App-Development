/**
 * Registry van e-mailtemplates — de bron van waarheid voor het templatebeheer.
 * Spiegelt het patroon van lib/audit-actions.ts: één record per template-key.
 *
 *   Nieuw e-mailtype toevoegen = één record hieronder (+ optioneel een
 *   call-site die `composeFromTemplate(key, …)` aanroept).
 *
 * Bewust GEEN `server-only`: de Superadmin-editor (client component) leest deze
 * registry voor de namen, omschrijvingen en placeholder-overzichten. De default-
 * inhoud (`defaultBodyHtml` met {{placeholders}}) dient als seed-bron én als
 * "herstel naar standaard". De gebrande shell (header/footer/kleuren) komt NIET
 * uit deze content maar wordt per tenant runtime toegevoegd door
 * lib/email/layout.ts (zie lib/email/template-render.ts).
 */

import type { Locale } from "@prisma/client";

export type EmailTemplateKey =
  | "magicLink"
  | "invite"
  | "welcome"
  | "passwordChanged"
  | "schemaAssigned"
  | "emailChange"
  | "notification"
  | "system";

/** Vertaalbare inhoud van één template (per taal). */
export type LocalizedContent = {
  subject: string;
  preheader: string;
  bodyHtml: string;
  /** Footer-transparantie ("Je ontvangt deze e-mail omdat…"). */
  reason: string;
};

export type PlaceholderDef = {
  token: string; // zonder accolades, bv. "firstName"
  label: string;
  sample: string; // voorbeeldwaarde voor de preview/testmail
  required?: boolean; // ontbreekt 'ie in de content → waarschuwing
};

export type EmailTemplateDef = {
  key: EmailTemplateKey;
  name: string;
  description: string;
  /** Footer-transparantie: "Je ontvangt deze e-mail omdat…" (mag placeholders bevatten). */
  reason: string;
  /** False = nog geen automatische verzend-trigger in de app (alleen testbaar). */
  hasTrigger: boolean;
  /** Template-specifieke placeholders (de globale komen daar bovenop). */
  placeholders: PlaceholderDef[];
  /** NL-standaardinhoud (bron/fallback). */
  defaultSubject: string;
  defaultPreheader: string;
  defaultBodyHtml: string;
  /**
   * Vertaalde standaardinhoud per taal (EN/FY). NL komt uit de `default*`-velden
   * hierboven. Ontbreekt een taal → val terug op NL. Zie `emailContentFor`.
   */
  localizedContent?: Partial<Record<Locale, LocalizedContent>>;
};

/**
 * Globale placeholders die in élke template beschikbaar zijn. Worden runtime
 * gevuld uit de tenant-branding (zie buildBrandingData in template-render.ts),
 * zodat content-only templates tóch de tenant-accentkleur/logo kunnen gebruiken.
 */
export const GLOBAL_PLACEHOLDERS: PlaceholderDef[] = [
  { token: "gymName", label: "Naam sportschool", sample: "FitPower" },
  { token: "currentYear", label: "Huidig jaar", sample: String(new Date().getFullYear()) },
  { token: "accentColor", label: "Accentkleur (hex)", sample: "#e84b1f" },
  { token: "accentText", label: "Tekstkleur op accent", sample: "#ffffff" },
  { token: "logoUrl", label: "Logo-URL", sample: "" },
  { token: "supportEmail", label: "Support-e-mailadres", sample: "info@gymrebel.nl" },
];

const INK = "#1f2937";
const MUTED = "#6b7280";

/** Bulletproof CTA-knop met placeholder-href/kleur (Outlook-VML + <a>-fallback). */
function button(hrefToken: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px">
  <tr>
    <td align="center" bgcolor="{{accentColor}}" style="border-radius:10px">
      <a href="{{${hrefToken}}}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;line-height:1;color:{{accentText}};text-decoration:none;border-radius:10px;background:{{accentColor}}">${label}</a>
    </td>
  </tr>
</table>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${INK}">${text}</h1>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${html}</p>`;
}

function muted(html: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">${html}</p>`;
}

const P_FIRSTNAME: PlaceholderDef = {
  token: "firstName",
  label: "Voornaam ontvanger",
  sample: "Jan",
};

export const EMAIL_TEMPLATE_DEFS: Record<EmailTemplateKey, EmailTemplateDef> = {
  // ── Inloglink (magic link) ────────────────────────────────────────────────
  magicLink: {
    key: "magicLink",
    name: "Inloglink",
    description: "Eenmalige magic-link waarmee een gebruiker veilig inlogt.",
    reason:
      "Je ontvangt deze e-mail omdat er een inloglink is aangevraagd voor je account bij {{gymName}}.",
    hasTrigger: true,
    placeholders: [
      { token: "loginLink", label: "Inloglink", sample: "https://gymrebel.app/auth/verify?token=…", required: true },
    ],
    defaultSubject: "Je inloglink voor {{gymName}}",
    defaultPreheader: "Je persoonlijke, eenmalige inloglink staat klaar.",
    defaultBodyHtml: [
      heading("Inloggen bij {{gymName}}"),
      paragraph(
        "Klik op de knop hieronder om veilig in te loggen. De link is eenmalig te gebruiken en verloopt na korte tijd."
      ),
      button("loginLink", "Inloggen"),
      muted(
        "Heb je geen inloglink aangevraagd? Dan kun je deze e-mail negeren — er gebeurt niets."
      ),
    ].join("\n"),
    localizedContent: {
      EN: {
        subject: "Your login link for {{gymName}}",
        preheader: "Your personal, one-time login link is ready.",
        reason:
          "You're receiving this email because a login link was requested for your account at {{gymName}}.",
        bodyHtml: [
          heading("Log in to {{gymName}}"),
          paragraph(
            "Click the button below to log in securely. The link works once and expires after a short time."
          ),
          button("loginLink", "Log in"),
          muted("Didn't request a login link? You can ignore this email — nothing will happen."),
        ].join("\n"),
      },
      FY: {
        subject: "Dyn ynloglink foar {{gymName}}",
        preheader: "Dyn persoanlike, ienmalige ynloglink stiet klear.",
        reason:
          "Do krigest dizze e-mail omdat der in ynloglink oanfrege is foar dyn account by {{gymName}}.",
        bodyHtml: [
          heading("Ynlogge by {{gymName}}"),
          paragraph(
            "Klik op de knop hjirûnder om feilich yn te loggen. De link is ienris te brûken en ferrint nei koarte tiid."
          ),
          button("loginLink", "Ynlogge"),
          muted("Hast gjin ynloglink oanfrege? Dan meist dizze e-mail negearje — der bart neat."),
        ].join("\n"),
      },
    },
  },

  // ── Accountuitnodiging ────────────────────────────────────────────────────
  invite: {
    key: "invite",
    name: "Accountuitnodiging",
    description: "Uitnodiging om een account te activeren (7 dagen geldig).",
    reason: "Je ontvangt deze e-mail omdat {{gymName}} je heeft uitgenodigd voor een account.",
    hasTrigger: true,
    placeholders: [
      { token: "activationLink", label: "Activatielink", sample: "https://gymrebel.app/invite/…", required: true },
    ],
    defaultSubject: "Uitnodiging voor {{gymName}}",
    defaultPreheader: "Activeer je account bij {{gymName}}.",
    defaultBodyHtml: [
      heading("Uitnodiging voor {{gymName}}"),
      paragraph(
        "Je bent uitgenodigd om een account te activeren bij <strong>{{gymName}}</strong>. Accepteer de uitnodiging om aan de slag te gaan met je trainingsschema's."
      ),
      button("activationLink", "Uitnodiging accepteren"),
      muted(
        "Deze uitnodiging is 7 dagen geldig. Verwachtte je deze e-mail niet? Dan kun je 'm negeren."
      ),
    ].join("\n"),
    localizedContent: {
      EN: {
        subject: "Invitation to {{gymName}}",
        preheader: "Activate your account at {{gymName}}.",
        reason: "You're receiving this email because {{gymName}} invited you to create an account.",
        bodyHtml: [
          heading("Invitation to {{gymName}}"),
          paragraph(
            "You've been invited to activate an account at <strong>{{gymName}}</strong>. Accept the invitation to get started with your training schedules."
          ),
          button("activationLink", "Accept invitation"),
          muted("This invitation is valid for 7 days. Didn't expect this email? You can ignore it."),
        ].join("\n"),
      },
      FY: {
        subject: "Útnûging foar {{gymName}}",
        preheader: "Aktivearje dyn account by {{gymName}}.",
        reason: "Do krigest dizze e-mail omdat {{gymName}} dy útnûge hat foar in account.",
        bodyHtml: [
          heading("Útnûging foar {{gymName}}"),
          paragraph(
            "Do bist útnûge om in account te aktivearjen by <strong>{{gymName}}</strong>. Akseptearje de útnûging om te begjinnen mei dyn trainingsskema's."
          ),
          button("activationLink", "Útnûging akseptearje"),
          muted("Dizze útnûging is 7 dagen jildich. Ferwachtest dizze e-mail net? Dan meist 'm negearje."),
        ].join("\n"),
      },
    },
  },

  // ── Welkom / account geactiveerd ──────────────────────────────────────────
  welcome: {
    key: "welcome",
    name: "Welkomstmail",
    description: "Bevestiging dat het account is geactiveerd, met inloglink.",
    reason: "Je ontvangt deze e-mail omdat je account bij {{gymName}} zojuist is geactiveerd.",
    hasTrigger: true,
    placeholders: [
      P_FIRSTNAME,
      { token: "loginLink", label: "Inloglink", sample: "https://gymrebel.app/login", required: true },
    ],
    defaultSubject: "Welkom bij {{gymName}}",
    defaultPreheader: "Je account is geactiveerd — log in om te beginnen.",
    defaultBodyHtml: [
      heading("Welkom bij {{gymName}}!"),
      paragraph("Hoi {{firstName}},"),
      paragraph(
        "Je account is geactiveerd. Log in om je trainingsschema's te bekijken, je voortgang bij te houden en aan de slag te gaan."
      ),
      button("loginLink", "Inloggen"),
    ].join("\n"),
    localizedContent: {
      EN: {
        subject: "Welcome to {{gymName}}",
        preheader: "Your account is active — log in to get started.",
        reason: "You're receiving this email because your account at {{gymName}} was just activated.",
        bodyHtml: [
          heading("Welcome to {{gymName}}!"),
          paragraph("Hi {{firstName}},"),
          paragraph(
            "Your account is active. Log in to view your training schedules, track your progress and get started."
          ),
          button("loginLink", "Log in"),
        ].join("\n"),
      },
      FY: {
        subject: "Wolkom by {{gymName}}",
        preheader: "Dyn account is aktyf — log yn om te begjinnen.",
        reason: "Do krigest dizze e-mail omdat dyn account by {{gymName}} krekt aktivearre is.",
        bodyHtml: [
          heading("Wolkom by {{gymName}}!"),
          paragraph("Hoi {{firstName}},"),
          paragraph(
            "Dyn account is aktyf. Log yn om dyn trainingsskema's te besjen, dyn fuortgong by te hâlden en te begjinnen."
          ),
          button("loginLink", "Ynlogge"),
        ].join("\n"),
      },
    },
  },

  // ── Wachtwoord gewijzigd ──────────────────────────────────────────────────
  passwordChanged: {
    key: "passwordChanged",
    name: "Wachtwoord gewijzigd",
    description: "Beveiligingsmelding nadat het wachtwoord is aangepast.",
    reason: "Je ontvangt deze e-mail omdat het wachtwoord van je {{gymName}}-account is gewijzigd.",
    hasTrigger: true,
    placeholders: [
      P_FIRSTNAME,
      { token: "securityLink", label: "Beveiligingslink", sample: "https://gymrebel.app/account/security", required: true },
    ],
    defaultSubject: "Je wachtwoord bij {{gymName}} is gewijzigd",
    defaultPreheader: "Een beveiligingsmelding over je account.",
    defaultBodyHtml: [
      heading("Je wachtwoord is gewijzigd"),
      paragraph("Hoi {{firstName}},"),
      paragraph(
        "Het wachtwoord van je account bij <strong>{{gymName}}</strong> is zojuist aangepast. Was jij dit? Dan hoef je niets te doen."
      ),
      paragraph("Heb jij dit <strong>niet</strong> gedaan? Beveilig dan direct je account."),
      button("securityLink", "Beveiliging bekijken"),
    ].join("\n"),
    localizedContent: {
      EN: {
        subject: "Your password at {{gymName}} was changed",
        preheader: "A security notification about your account.",
        reason: "You're receiving this email because the password for your {{gymName}} account was changed.",
        bodyHtml: [
          heading("Your password was changed"),
          paragraph("Hi {{firstName}},"),
          paragraph(
            "The password for your account at <strong>{{gymName}}</strong> was just changed. Was this you? Then you don't need to do anything."
          ),
          paragraph("Didn't do this <strong>yourself</strong>? Secure your account right away."),
          button("securityLink", "View security"),
        ].join("\n"),
      },
      FY: {
        subject: "Dyn wachtwurd by {{gymName}} is feroare",
        preheader: "In feiligheidsmelding oer dyn account.",
        reason: "Do krigest dizze e-mail omdat it wachtwurd fan dyn {{gymName}}-account feroare is.",
        bodyHtml: [
          heading("Dyn wachtwurd is feroare"),
          paragraph("Hoi {{firstName}},"),
          paragraph(
            "It wachtwurd fan dyn account by <strong>{{gymName}}</strong> is krekt oanpast. Wiesto dit? Dan hoechst neat te dwaan."
          ),
          paragraph("Hasto dit <strong>net</strong> dien? Befeilich dan fuortendaliks dyn account."),
          button("securityLink", "Befeiliging besjen"),
        ].join("\n"),
      },
    },
  },

  // ── Nieuw trainingsschema toegewezen ──────────────────────────────────────
  schemaAssigned: {
    key: "schemaAssigned",
    name: "Nieuw trainingsschema toegewezen",
    description: "Melding dat er een nieuw trainingsschema klaarstaat.",
    reason: "Je ontvangt deze e-mail omdat {{gymName}} een trainingsschema aan je heeft toegewezen.",
    hasTrigger: true,
    placeholders: [
      P_FIRSTNAME,
      { token: "workoutName", label: "Naam trainingsschema", sample: "Full Body Beginner", required: true },
      { token: "schemaLink", label: "Link naar het schema", sample: "https://gymrebel.app/member/schema", required: true },
    ],
    defaultSubject: "Nieuw trainingsschema: {{workoutName}}",
    defaultPreheader: "{{workoutName}} staat voor je klaar.",
    defaultBodyHtml: [
      heading("Je hebt een nieuw trainingsschema"),
      paragraph("Hoi {{firstName}},"),
      paragraph(
        "<strong>{{gymName}}</strong> heeft een nieuw trainingsschema voor je klaargezet: <strong>{{workoutName}}</strong>. Bekijk je oefeningen en begin je volgende training."
      ),
      button("schemaLink", "Bekijk je schema"),
    ].join("\n"),
    localizedContent: {
      EN: {
        subject: "New training schedule: {{workoutName}}",
        preheader: "{{workoutName}} is ready for you.",
        reason: "You're receiving this email because {{gymName}} assigned a training schedule to you.",
        bodyHtml: [
          heading("You have a new training schedule"),
          paragraph("Hi {{firstName}},"),
          paragraph(
            "<strong>{{gymName}}</strong> has set up a new training schedule for you: <strong>{{workoutName}}</strong>. Check your exercises and start your next workout."
          ),
          button("schemaLink", "View your schedule"),
        ].join("\n"),
      },
      FY: {
        subject: "Nij trainingsskema: {{workoutName}}",
        preheader: "{{workoutName}} stiet foar dy klear.",
        reason: "Do krigest dizze e-mail omdat {{gymName}} in trainingsskema oan dy tawiisd hat.",
        bodyHtml: [
          heading("Do hast in nij trainingsskema"),
          paragraph("Hoi {{firstName}},"),
          paragraph(
            "<strong>{{gymName}}</strong> hat in nij trainingsskema foar dy klearset: <strong>{{workoutName}}</strong>. Besjoch dyn oefeningen en begjin dyn folgjende training."
          ),
          button("schemaLink", "Besjoch dyn skema"),
        ].join("\n"),
      },
    },
  },

  // ── E-mailadres wijzigen ──────────────────────────────────────────────────
  emailChange: {
    key: "emailChange",
    name: "E-mailadres bevestigen",
    description: "Bevestigingslink bij het wijzigen van het e-mailadres.",
    reason:
      "Je ontvangt deze e-mail omdat er is gevraagd om het e-mailadres van je {{gymName}}-account te wijzigen.",
    hasTrigger: true,
    placeholders: [
      { token: "newEmail", label: "Nieuw e-mailadres", sample: "nieuw@voorbeeld.nl", required: true },
      { token: "confirmLink", label: "Bevestigingslink", sample: "https://gymrebel.app/account/confirm-email?token=…", required: true },
    ],
    defaultSubject: "Bevestig je nieuwe e-mailadres",
    defaultPreheader: "Bevestig de wijziging naar {{newEmail}}.",
    defaultBodyHtml: [
      heading("Bevestig je nieuwe e-mailadres"),
      paragraph(
        "Klik om je e-mailadres voor <strong>{{gymName}}</strong> te wijzigen naar <strong>{{newEmail}}</strong>."
      ),
      button("confirmLink", "E-mailadres bevestigen"),
      muted(
        "Heb je dit niet aangevraagd? Negeer deze e-mail; je e-mailadres blijft dan ongewijzigd."
      ),
    ].join("\n"),
    localizedContent: {
      EN: {
        subject: "Confirm your new email address",
        preheader: "Confirm the change to {{newEmail}}.",
        reason:
          "You're receiving this email because a request was made to change the email address of your {{gymName}} account.",
        bodyHtml: [
          heading("Confirm your new email address"),
          paragraph(
            "Click to change your email address for <strong>{{gymName}}</strong> to <strong>{{newEmail}}</strong>."
          ),
          button("confirmLink", "Confirm email address"),
          muted("Didn't request this? Ignore this email; your email address will stay the same."),
        ].join("\n"),
      },
      FY: {
        subject: "Befêstigje dyn nije e-mailadres",
        preheader: "Befêstigje de wiziging nei {{newEmail}}.",
        reason:
          "Do krigest dizze e-mail omdat der frege is om it e-mailadres fan dyn {{gymName}}-account te wizigjen.",
        bodyHtml: [
          heading("Befêstigje dyn nije e-mailadres"),
          paragraph(
            "Klik om dyn e-mailadres foar <strong>{{gymName}}</strong> te wizigjen nei <strong>{{newEmail}}</strong>."
          ),
          button("confirmLink", "E-mailadres befêstigje"),
          muted("Hast dit net oanfrege? Negearje dizze e-mail; dyn e-mailadres bliuwt dan ûnferoare."),
        ].join("\n"),
      },
    },
  },

  // ── Algemene notificatie (nog geen automatische trigger) ──────────────────
  notification: {
    key: "notification",
    name: "Algemene notificatie",
    description: "Vrij in te vullen notificatiemail. Nog geen automatische trigger — wel testbaar.",
    reason: "Je ontvangt deze e-mail omdat je een melding hebt bij {{gymName}}.",
    hasTrigger: false,
    placeholders: [
      P_FIRSTNAME,
      { token: "title", label: "Titel", sample: "Je sportschool is op zondag gesloten" },
      { token: "message", label: "Bericht", sample: "Let op: aanstaande zondag zijn we wegens onderhoud gesloten." },
      { token: "actionLabel", label: "Knoptekst (optioneel)", sample: "Bekijk de openingstijden" },
      { token: "actionLink", label: "Knoplink (optioneel)", sample: "https://gymrebel.app" },
    ],
    defaultSubject: "{{title}}",
    defaultPreheader: "Een bericht van {{gymName}}.",
    defaultBodyHtml: [
      heading("{{title}}"),
      paragraph("Hoi {{firstName}},"),
      paragraph("{{message}}"),
      button("actionLink", "{{actionLabel}}"),
    ].join("\n"),
  },

  // ── Systeemmelding (platform, nog geen automatische trigger) ──────────────
  system: {
    key: "system",
    name: "Systeemmelding",
    description: "Technische/platformmelding. Nog geen automatische trigger — wel testbaar.",
    reason: "Je ontvangt deze e-mail omdat er een systeemmelding is voor je {{gymName}}-account.",
    hasTrigger: false,
    placeholders: [
      { token: "title", label: "Titel", sample: "Gepland onderhoud" },
      { token: "message", label: "Bericht", sample: "Op zaterdagnacht voeren we onderhoud uit. De app is dan kort niet bereikbaar." },
    ],
    defaultSubject: "Systeemmelding: {{title}}",
    defaultPreheader: "Belangrijke melding over het platform.",
    defaultBodyHtml: [
      heading("{{title}}"),
      paragraph("{{message}}"),
      muted("Dit is een automatische systeemmelding van {{gymName}}."),
    ].join("\n"),
  },
};

/** Geordende lijst voor het overzicht (insertie-volgorde van de record). */
export const EMAIL_TEMPLATE_ORDER = Object.keys(
  EMAIL_TEMPLATE_DEFS
) as EmailTemplateKey[];

export function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return value in EMAIL_TEMPLATE_DEFS;
}

export function getTemplateDef(key: string): EmailTemplateDef | null {
  return isEmailTemplateKey(key) ? EMAIL_TEMPLATE_DEFS[key] : null;
}

/** Alle placeholders voor een template: globaal + template-specifiek. */
export function placeholdersFor(key: EmailTemplateKey): PlaceholderDef[] {
  return [...EMAIL_TEMPLATE_DEFS[key].placeholders, ...GLOBAL_PLACEHOLDERS];
}

/** Set met toegestane tokens (voor validatie). */
export function allowedTokens(key: EmailTemplateKey): Set<string> {
  return new Set(placeholdersFor(key).map((p) => p.token));
}

/**
 * Gelokaliseerde standaardinhoud voor een template. NL komt uit de `default*`-
 * velden; EN/FY uit `localizedContent`. Ontbreekt de gevraagde taal → NL. Dit is
 * de bron voor zowel het seeden per taal als de code-fallback in
 * `composeFromTemplate` (lib/email/template-render.ts).
 */
export function emailContentFor(
  key: EmailTemplateKey,
  locale: Locale
): LocalizedContent {
  const def = EMAIL_TEMPLATE_DEFS[key];
  const nl: LocalizedContent = {
    subject: def.defaultSubject,
    preheader: def.defaultPreheader,
    bodyHtml: def.defaultBodyHtml,
    reason: def.reason,
  };
  if (locale === "NL") return nl;
  return def.localizedContent?.[locale] ?? nl;
}
