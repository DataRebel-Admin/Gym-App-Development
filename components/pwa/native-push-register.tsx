"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { registerNativePushToken } from "@/app/account/native-push-actions";
import { ALL_PUSH_CHANNELS } from "@/lib/push-channels";
import { NATIVE_PUSH_TOKEN_KEY } from "@/lib/push-token-storage";

/** Of native push op dit platform iets kan bezorgen; komt server-side uit `nativePushConfigured()`. */
export type NativePushAvailability = { ios: boolean; android: boolean };

/**
 * Registreert het native push-device-token (APNs op iOS / FCM op Android) bij de
 * server en maakt de Android-meldingskanalen aan.
 *
 * Het *reageren* op meldingen (binnenkomst en aantikken) zit bewust in
 * `NativePushListeners`, gemount in de root-layout. Dit component hangt namelijk
 * in de member- en owner-layout omdat het een ingelogde gebruiker nodig heeft, en
 * listeners die alleen dáár bestaan werken niet vanaf bijvoorbeeld `/account`.
 *
 * Doet uitsluitend iets in de Capacitor-app (`isNativePlatform`); op web is het
 * een no-op, want daar loopt push via de service worker en VAPID. Mount in een
 * geauthenticeerde layout, zodat de permissievraag ná login komt: een app die
 * meteen bij de eerste start om meldingen vraagt, krijgt vaker "nee".
 *
 * ## Waarom er een `configured`-prop is en niet gewoon altijd geregistreerd wordt
 *
 * `PushNotifications.register()` roept op Android `FirebaseMessaging.getInstance()`
 * aan. Ontbreekt `google-services.json` in de APK, dan gooit dat
 * `IllegalStateException: Default FirebaseApp is not initialized` — **native, op de
 * CapacitorPlugins-thread**. Een `try/catch` hieronder vangt dat niet: het proces
 * gaat eraan en de app sluit precies op het moment dat de gebruiker meldingen
 * toestaat. Daarom vragen we alleen toestemming als de server bevestigt dat er ook
 * daadwerkelijk iets bezorgd kán worden.
 */
export function NativePushRegister({ configured }: { configured: NativePushAvailability }) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Kan dit platform überhaupt een melding bezorgen? Zo niet: niets doen, en
    // vooral geen permissie vragen. Zie de toelichting boven dit bestand.
    const platform = Capacitor.getPlatform();
    const supported =
      platform === "android" ? configured.android : platform === "ios" ? configured.ios : false;
    if (!supported) return;

    let cancelled = false;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;

        // Android-meldingskanalen. Moeten bestaan vóórdat er een melding met een
        // `channel_id` binnenkomt, anders valt die terug op het standaardkanaal.
        // Idempotent: bestaat een kanaal al, dan is dit een no-op (en Android
        // negeert bewust wijzigingen, zie lib/push-channels.ts).
        if (platform === "android") {
          for (const channel of ALL_PUSH_CHANNELS) {
            await PushNotifications.createChannel({
              id: channel.id,
              name: channel.name,
              description: channel.description,
              importance: channel.importance,
              visibility: 1, // zichtbaar op het vergrendelscherm, zonder inhoud te verbergen
            }).catch(() => {
              /* stil — een kanaal minder is geen reden om registratie te staken */
            });
          }
        }

        await PushNotifications.addListener("registration", (token) => {
          if (cancelled) return;
          // Lokaal onthouden zodat we 'm bij uitloggen kunnen intrekken; het
          // token is dan niet meer via de plugin op te vragen zonder opnieuw te
          // registreren. Zie components/pwa/native-push-cleanup.tsx.
          try {
            window.localStorage.setItem(NATIVE_PUSH_TOKEN_KEY, token.value);
          } catch {
            /* privémodus of vol quotum → dan maar geen opruiming bij uitloggen */
          }
          void registerNativePushToken({ token: token.value, platform: platform === "android" ? "android" : "ios" });
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
  }, [configured.android, configured.ios]);

  return null;
}
