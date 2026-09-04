/**
 * Onthoudt per toestel (localStorage) dat hier een passkey is ingesteld of
 * succesvol gebruikt. De inlogpagina start dan direct de biometrische login
 * (vingerafdruk/Face ID) in plaats van te wachten tot de knop wordt aangetikt.
 *
 * Bewust géén server-state: welke toestellen een passkey hébben weet alleen het
 * toestel zelf. De vlag is een hint, geen waarheid — de login valt bij
 * annuleren of een ontbrekende sleutel gewoon terug op het formulier.
 * Alleen vanuit client-componenten gebruiken (leest `window`).
 */
const KEY = "gymrebel-passkey-device";

export function markPasskeyDevice(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* genegeerd */
  }
}

export function isPasskeyDevice(): boolean {
  try {
    return Boolean(window.localStorage.getItem(KEY));
  } catch {
    return false;
  }
}
