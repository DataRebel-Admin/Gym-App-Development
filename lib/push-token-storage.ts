/**
 * Sleutel waaronder de native app z'n eigen push-token in localStorage bewaart.
 *
 * Puur en apart, zodat zowel de registratie
 * (`components/pwa/native-push-register.tsx`) als de opruiming
 * (`components/pwa/native-push-cleanup.tsx`) dezelfde sleutel gebruiken zonder
 * dat de een de ander importeert.
 *
 * Waarom überhaupt lokaal opslaan: het token is na registratie niet meer bij de
 * plugin op te vragen zonder opnieuw te registreren, en dat wil je bij uitloggen
 * niet doen. Zonder deze kopie zouden we bij het uitloggen niet weten wélk token
 * ingetrokken moet worden.
 */
export const NATIVE_PUSH_TOKEN_KEY = "gymrebel-native-push-token";
