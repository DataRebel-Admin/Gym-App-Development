/**
 * Bedrijfs- en contactgegevens voor de juridische pagina's (/privacy, /cookies)
 * en de store-listings. Puur (géén `server-only`) zodat het ook client-bruikbaar
 * is; idioom van `lib/exercise-types.ts`.
 *
 * ⚠️ **Vóór livegang invullen en juridisch laten controleren.** De waarden met
 * `TODO` hieronder zijn placeholders: een privacyverklaring zonder correcte
 * verwerkersgegevens voldoet niet aan artikel 13 AVG, en beide stores vragen om
 * een werkend contactadres.
 */
export const LEGAL_ENTITY = {
  /** Statutaire naam van de aanbieder van de app. */
  name: "Data Rebel",
  /** Handelsnaam waaronder de app wordt uitgegeven. */
  tradeName: "GymRebel Training",
  /** TODO invullen: volledig vestigingsadres. */
  address: "TODO: straat en huisnummer",
  postalCode: "TODO: postcode",
  city: "Leeuwarden",
  country: "Nederland",
  /** TODO invullen: KvK-nummer (verplicht in de verklaring). */
  cocNumber: "TODO: KvK-nummer",
  /** Algemeen contactadres, ook gebruikt als support-URL in de stores. */
  email: "support@gymrebel-training.nl",
  /**
   * Privacy-contact. Is er een functionaris voor gegevensbescherming aangesteld,
   * zet dan diens gegevens hier; anders volstaat het algemene adres.
   */
  privacyEmail: "privacy@gymrebel-training.nl",
  website: "https://gymrebel-training.nl",
} as const;

/** Datum van de laatste inhoudelijke wijziging aan de juridische teksten. */
export const LEGAL_UPDATED_AT = "2026-07-31";

/**
 * Verwerkers en subverwerkers. Elk hier genoemd bedrijf verwerkt persoonsgegevens
 * namens ons; de AVG verplicht om ze transparant te benoemen, inclusief de vraag
 * of er gegevens buiten de EER gaan.
 *
 * Afgeleid uit wat de code daadwerkelijk aanroept. Voeg je een dienst toe, voeg
 * 'm hier dan óók toe: dat is de enige plek waar dit onderhouden wordt.
 */
export const PROCESSORS: {
  name: string;
  purpose: string;
  region: string;
}[] = [
  { name: "Vercel", purpose: "Hosting van de applicatie", region: "EU (Frankfurt)" },
  { name: "Neon", purpose: "PostgreSQL-database", region: "EU" },
  { name: "Vercel Blob", purpose: "Door gebruikers geüploade afbeeldingen", region: "EU" },
  { name: "Microsoft Azure", purpose: "Opslag van oefeningmedia en e-mailverzending via Graph", region: "EU" },
  { name: "Anthropic", purpose: "AI-assistent, alleen als je sportschool die inschakelt", region: "EU (inference_geo)" },
  { name: "Apple", purpose: "Pushmeldingen op iOS (APNs)", region: "VS, adequaatheidsbesluit" },
  { name: "Google", purpose: "Pushmeldingen op Android (FCM)", region: "VS, adequaatheidsbesluit" },
];
