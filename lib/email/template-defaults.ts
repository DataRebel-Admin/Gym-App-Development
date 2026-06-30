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

export type EmailTemplateKey =
  | "magicLink"
  | "invite"
  | "welcome"
  | "passwordChanged"
  | "schemaAssigned"
  | "emailChange"
  | "notification"
  | "system";

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
  defaultSubject: string;
  defaultPreheader: string;
  defaultBodyHtml: string;
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
  { token: "supportEmail", label: "Support-e-mailadres", sample: "info@fitpower.nl" },
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
      { token: "loginLink", label: "Inloglink", sample: "https://fitpower.gymrebel.app/auth/verify?token=…", required: true },
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
  },

  // ── Accountuitnodiging ────────────────────────────────────────────────────
  invite: {
    key: "invite",
    name: "Accountuitnodiging",
    description: "Uitnodiging om een account te activeren (7 dagen geldig).",
    reason: "Je ontvangt deze e-mail omdat {{gymName}} je heeft uitgenodigd voor een account.",
    hasTrigger: true,
    placeholders: [
      { token: "activationLink", label: "Activatielink", sample: "https://fitpower.gymrebel.app/invite/…", required: true },
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
      { token: "loginLink", label: "Inloglink", sample: "https://fitpower.gymrebel.app/login", required: true },
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
      { token: "securityLink", label: "Beveiligingslink", sample: "https://fitpower.gymrebel.app/account/security", required: true },
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
      { token: "schemaLink", label: "Link naar het schema", sample: "https://fitpower.gymrebel.app/member/schema", required: true },
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
      { token: "confirmLink", label: "Bevestigingslink", sample: "https://fitpower.gymrebel.app/account/confirm-email?token=…", required: true },
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
      { token: "actionLink", label: "Knoplink (optioneel)", sample: "https://fitpower.gymrebel.app" },
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
