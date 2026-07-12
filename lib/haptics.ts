import { Capacitor } from "@capacitor/core";

/**
 * Haptische feedback met native laag op iOS/Android (Capacitor Haptics) en
 * `navigator.vibrate` als web-fallback. Client-only (gebruikt navigator/Capacitor);
 * alleen importeren vanuit client-componenten.
 *
 * Op web blijft het exacte trilpatroon behouden; native mapt naar de passende
 * Taptic Engine-feedback (impact/notification) — dat voelt beter dan een ruwe
 * vibratie en is een concrete native-functionaliteit voor de app-stores.
 */
type Feel = "light" | "medium" | "success";

export async function haptic(feel: Feel, webPattern: number | number[]): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      if (feel === "success") {
        await Haptics.notification({ type: NotificationType.Success });
      } else {
        await Haptics.impact({ style: feel === "light" ? ImpactStyle.Light : ImpactStyle.Medium });
      }
      return;
    } catch {
      // Val terug op de web-API als de plugin (nog) niet beschikbaar is.
    }
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(webPattern);
  }
}
