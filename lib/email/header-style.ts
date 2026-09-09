/**
 * Opmaak van de **bovenste balk** in e-mails: de accentbalk met daarin het logo
 * (of, zonder logo, de naam als tekst-wordmerk). Zie `header()` in
 * lib/email/layout.ts voor de HTML die deze CSS draagt.
 *
 * Bewust GEEN `server-only`: de Superadmin-editor (client component) leest de
 * standaardwaarden en saneert live mee.
 *
 * **Waarom losse CSS-velden en geen vrij HTML-blok.** De koptekst moet in élke
 * mailclient kloppen. Outlook rendert met de Word-engine en negeert een
 * `<style>`-blok voor precies de dingen die hier tellen (achtergrond op een
 * `<td>`), dus de opmaak móét inline staan. Door alleen de declaraties
 * bewerkbaar te maken en de tabelstructuur vast te houden, kan een aanpassing de
 * mail niet slopen: het ergste dat kan gebeuren is een lelijke balk.
 *
 * De waarden zijn de **volledige** inline-stijl, niet een aanvulling erop. Zo
 * ziet de beheerder in de editor precies wat er in de mail staat en kan hij een
 * declaratie ook weghálen. "Herstel standaard" zet de code-defaults terug.
 */

/** Tokens die in de CSS gebruikt mogen worden — hiermee blijft de balk whitelabel. */
export const HEADER_STYLE_TOKENS = ["accentColor", "accentText", "secondaryColor"] as const;

export type HeaderStyleToken = (typeof HEADER_STYLE_TOKENS)[number];

export type EmailHeaderStyle = {
  /** De balk zelf: de `<td>` over de volle breedte van de mailkaart. */
  barCss: string;
  /** Het vlak direct onder het logo (standaard een witte badge). */
  badgeCss: string;
  /** Het logo (`<img>`) zelf. */
  logoCss: string;
  /** De tekst-wordmark, gebruikt door sportscholen zonder (bruikbaar) logo. */
  wordmarkCss: string;
  /**
   * Weergavebreedte van het logo in px. Apart veld en geen CSS, omdat Outlook
   * het `width`-attribuut nodig heeft; alleen `max-width` negeert het.
   */
  logoWidth: number;
};

export const DEFAULT_EMAIL_HEADER_STYLE: EmailHeaderStyle = {
  barCss: "background:{{accentColor}};padding:28px 32px;text-align:center",
  badgeCss: "background:#ffffff;border-radius:10px;padding:10px 16px",
  logoCss: "display:block;max-width:160px;height:auto;border:0;margin:0 auto",
  wordmarkCss:
    "font-size:22px;font-weight:800;letter-spacing:-0.02em;color:{{accentText}}",
  logoWidth: 160,
};

/** Velden die de editor als CSS-invoer toont (volgorde = weergavevolgorde). */
export const HEADER_CSS_FIELDS: {
  key: "barCss" | "badgeCss" | "logoCss" | "wordmarkCss";
  label: string;
  hint: string;
}[] = [
  {
    key: "barCss",
    label: "Balk",
    hint: "De gekleurde balk over de volle breedte. Standaard de accentkleur van de sportschool.",
  },
  {
    key: "badgeCss",
    label: "Vlak onder het logo",
    hint: "Standaard een witte badge, zodat een logo in elke kleur zichtbaar blijft op de balk.",
  },
  { key: "logoCss", label: "Logo", hint: "De afbeelding zelf." },
  {
    key: "wordmarkCss",
    label: "Naam als tekst",
    hint: "Wordt getoond bij een sportschool zonder bruikbaar logo.",
  },
];

export const HEADER_CSS_MAX_LENGTH = 400;
export const LOGO_WIDTH_MIN = 40;
/** De mailkaart is 600px breed; met de standaardpadding blijft ~536px over. */
export const LOGO_WIDTH_MAX = 536;

/**
 * Maak een CSS-waarde veilig om in een `style="…"`-attribuut te zetten.
 * `"` zou het attribuut sluiten en `<`/`>` zouden nieuwe HTML kunnen beginnen —
 * de Superadmin is vertrouwd, maar één typefout mag nooit de hele mail slopen.
 */
export function sanitizeHeaderCss(raw: string): string {
  return raw
    .replace(/[<>"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, HEADER_CSS_MAX_LENGTH);
}

export function clampLogoWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EMAIL_HEADER_STYLE.logoWidth;
  return Math.min(LOGO_WIDTH_MAX, Math.max(LOGO_WIDTH_MIN, Math.round(value)));
}

/** Vervang de toegestane tokens; een onbekend token wordt leeg (nooit zichtbaar). */
export function applyHeaderTokens(
  css: string,
  values: Record<HeaderStyleToken, string>
): string {
  return css.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token: string) =>
    (HEADER_STYLE_TOKENS as readonly string[]).includes(token)
      ? values[token as HeaderStyleToken]
      : ""
  );
}

/** Saneer een (deels ingevuld) stijlobject naar een volledige, veilige stijl. */
export function sanitizeHeaderStyle(
  input: Partial<EmailHeaderStyle> | null | undefined
): EmailHeaderStyle {
  const base = DEFAULT_EMAIL_HEADER_STYLE;
  const css = (value: unknown, fallback: string) =>
    typeof value === "string" ? sanitizeHeaderCss(value) : fallback;
  return {
    barCss: css(input?.barCss, base.barCss),
    badgeCss: css(input?.badgeCss, base.badgeCss),
    logoCss: css(input?.logoCss, base.logoCss),
    wordmarkCss: css(input?.wordmarkCss, base.wordmarkCss),
    logoWidth: clampLogoWidth(
      typeof input?.logoWidth === "number" ? input.logoWidth : base.logoWidth
    ),
  };
}

/**
 * Lees de opgeslagen stijl (JSON in PlatformSetting). Onleesbare of ontbrekende
 * opslag valt terug op de code-standaard — een kapotte rij mag nooit betekenen
 * dat er geen koptekst meer is.
 */
export function parseHeaderStyle(json: string | null | undefined): EmailHeaderStyle {
  if (!json) return DEFAULT_EMAIL_HEADER_STYLE;
  try {
    const raw: unknown = JSON.parse(json);
    if (!raw || typeof raw !== "object") return DEFAULT_EMAIL_HEADER_STYLE;
    return sanitizeHeaderStyle(raw as Partial<EmailHeaderStyle>);
  } catch {
    return DEFAULT_EMAIL_HEADER_STYLE;
  }
}

export function serializeHeaderStyle(style: EmailHeaderStyle): string {
  return JSON.stringify(sanitizeHeaderStyle(style));
}

/** Staat deze stijl gelijk aan de code-standaard? (Editor toont dat als badge.) */
export function isDefaultHeaderStyle(style: EmailHeaderStyle): boolean {
  const a = sanitizeHeaderStyle(style);
  const b = DEFAULT_EMAIL_HEADER_STYLE;
  return (
    a.barCss === sanitizeHeaderCss(b.barCss) &&
    a.badgeCss === sanitizeHeaderCss(b.badgeCss) &&
    a.logoCss === sanitizeHeaderCss(b.logoCss) &&
    a.wordmarkCss === sanitizeHeaderCss(b.wordmarkCss) &&
    a.logoWidth === b.logoWidth
  );
}
