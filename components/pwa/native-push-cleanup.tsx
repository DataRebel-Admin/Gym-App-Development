"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { unregisterNativePushToken } from "@/app/account/native-push-actions";
import { NATIVE_PUSH_TOKEN_KEY } from "@/lib/push-token-storage";

/**
 * Trekt het push-token van dit toestel in zodra er niemand meer is ingelogd.
 *
 * ## Waarom op het loginscherm en niet in de uitlogknop
 *
 * Uitloggen is een server action die direct redirect naar `/login`, dus er is
 * geen moment waarop client-side code er nog tussen kan. Bovendien zijn er
 * meerdere uitwegen: de uitlogknop, "log overal uit" na een wachtwoordwijziging,
 * en een sessie die simpelweg verloopt. Het loginscherm is het enige punt waar
 * ze allemaal langskomen, en de betekenis is er ondubbelzinnig: hier is niemand
 * ingelogd, dus dit toestel hoort geen meldingen meer te krijgen.
 *
 * No-op op web en wanneer er geen token bewaard is.
 */
export function NativePushCleanup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let token: string | null = null;
    try {
      token = window.localStorage.getItem(NATIVE_PUSH_TOKEN_KEY);
    } catch {
      return;
    }
    if (!token) return;

    // Lokaal meteen wissen, ook als de server onbereikbaar is. Anders blijft dit
    // bij elke weergave van het loginscherm opnieuw proberen.
    try {
      window.localStorage.removeItem(NATIVE_PUSH_TOKEN_KEY);
    } catch {
      /* stil */
    }

    void unregisterNativePushToken(token).catch(() => {
      /* best-effort: het token verloopt vanzelf zodra FCM of APNs 'm afkeurt */
    });
  }, []);

  return null;
}
