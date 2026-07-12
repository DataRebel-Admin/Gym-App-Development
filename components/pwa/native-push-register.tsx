"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { registerNativePushToken } from "@/app/account/native-push-actions";

/**
 * Registreert het native push-device-token (APNs op iOS / FCM op Android) bij de
 * server. Doet uitsluitend iets in de Capacitor-app (`isNativePlatform`); op web
 * is het een no-op (daar loopt push via de service worker / VAPID). Mount in een
 * geauthenticeerde layout, zodat de permissievraag ná login komt.
 */
export function NativePushRegister() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;

        await PushNotifications.addListener("registration", (token) => {
          if (cancelled) return;
          const platform = Capacitor.getPlatform() === "android" ? "android" : "ios";
          void registerNativePushToken({ token: token.value, platform });
        });
        await PushNotifications.addListener("registrationError", () => {
          /* stil — geen token, geen native push */
        });
        await PushNotifications.register();
      } catch {
        /* plugin niet beschikbaar → stil */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
