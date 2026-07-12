/**
 * Gedeeld login-formulier-resultaattype. Bewust in een **neutrale** module (geen
 * "use server", geen "server-only") zodat zowel de server-actions als de client-
 * formulieren het kunnen importeren. Een `"use server"`-bestand mag geen types
 * (her)exporteren — dat ziet de action-compiler aan voor een server-action.
 */
export type LoginState = { error?: string };
