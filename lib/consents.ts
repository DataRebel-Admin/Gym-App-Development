// Toestemmingen-registry (puur, ook client — idioom exercise-types.ts): één
// bron van waarheid voor de privacy-toggles op /account/privacy. Het formulier
// rendert deze lijst; de server-action (saveConsents) valideert ertegen zodat
// alleen bekende sleutels met boolean-waarden in `User.consents` belanden.
// Nieuwe toestemming = één record hier.
export const CONSENT_OPTIONS = [
  {
    key: "product_updates",
    label: "Productupdates",
    hint: "Nieuwe functies en verbeteringen.",
  },
  {
    key: "marketing",
    label: "Marketing-e-mails",
    hint: "Aanbiedingen en nieuwsbrieven.",
  },
  {
    key: "usage_analytics",
    label: "Gebruiksanalyse",
    hint: "Anonieme statistieken om de app te verbeteren.",
  },
] as const;

export type ConsentKey = (typeof CONSENT_OPTIONS)[number]["key"];
