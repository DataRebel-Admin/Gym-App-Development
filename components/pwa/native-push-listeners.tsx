"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/components/ui/toast";

/**
 * Luistert naar binnenkomende en aangetikte pushmeldingen. Gemount in de
 * **root-layout**, dus actief op élke pagina van de native app.
 *
 * ## Waarom apart van NativePushRegister
 *
 * Dat component vraagt toestemming en registreert het device-token, en hoort
 * daarom pas ná login te draaien: het hangt in de member- en owner-layout.
 * De listeners hebben die beperking niet, en mogen die ook niet hebben.
 *
 * Zaten ze in hetzelfde component, dan werkte het aantikken van een melding
 * alleen zolang de gebruiker toevallig op een `/member`- of `/owner`-pagina
 * stond. Precies dát ging mis: vanaf `/account/profiel` (eigen layout) bracht
 * een tik de app wél naar voren, maar navigeerde hij nergens heen.
 *
 * No-op op web: daar loopt push via de service worker, die z'n eigen
 * notificationclick afhandelt.
 */
export function NativePushListeners() {
  const { toast } = useToast();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    const handles: { remove: () => Promise<void> }[] = [];

    void (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // Melding binnen terwijl de app openstaat. Het systeem toont die dan
        // níét (Android onderdrukt 'm, iOS alleen met presentationOptions), dus
        // zonder dit zou een melding tijdens gebruik volledig onzichtbaar zijn.
        handles.push(
          await PushNotifications.addListener("pushNotificationReceived", (notification) => {
            if (cancelled) return;
            const title = notification.title?.trim();
            const body = notification.body?.trim();
            if (!title && !body) return;
            toast(title && body ? `${title}: ${body}` : (title ?? body ?? ""), "info");
          })
        );

        // Melding aangetikt → navigeer naar de bijbehorende pagina. Zowel de
        // APNs- als de FCM-verzender sturen de bestemming mee als `data.url`
        // (lib/push-apns.ts / lib/push-fcm.ts).
        handles.push(
          await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            if (cancelled) return;
            const url = action.notification.data?.url;
            if (typeof url !== "string" || !url) return;
            // Alleen paden binnen de app volgen; een absolute URL uit een payload
            // zou de WebView naar een willekeurige site kunnen sturen.
            if (!url.startsWith("/") || url.startsWith("//")) return;
            window.location.assign(url);
          })
        );

        // Tussen het starten van dit effect en het toevoegen van de listeners kan
        // de component al ontkoppeld zijn; dan meteen weer opruimen.
        if (cancelled) for (const h of handles) void h.remove();
      } catch {
        /* plugin niet beschikbaar → stil */
      }
    })();

    return () => {
      cancelled = true;
      // Wél daadwerkelijk verwijderen. Bleven ze hangen, dan stapelen ze zich op
      // bij elke re-mount en blijft alleen de laatste werken, terwijl de rest
      // stilletjes niets doet.
      for (const h of handles) void h.remove();
    };
  }, [toast]);

  return null;
}
