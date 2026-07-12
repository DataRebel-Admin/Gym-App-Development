"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { subscribeToPush, unsubscribeFromPush } from "../push-actions";

/** base64url → Uint8Array (VAPID applicationServerKey). */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "busy";

/**
 * Pushmeldingen aan/uit op dít apparaat. Registreert de service worker, vraagt
 * toestemming en slaat het abonnement server-side op. Degradeert netjes: zonder
 * VAPID-sleutel of browser-ondersteuning toont 'ie een nette melding.
 */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!vapidPublicKey) {
      setState("unsupported");
      return;
    }
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidPublicKey]);

  async function enable() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: lib.dom typeert applicationServerKey strikter dan een Uint8Array<ArrayBufferLike>.
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await subscribeToPush({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribeFromPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-1 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-neutral-900">Pushmeldingen op dit apparaat</p>
        <p className="text-xs text-neutral-500">
          {state === "unsupported"
            ? "Niet beschikbaar in deze browser of nog niet geconfigureerd."
            : state === "denied"
              ? "Geblokkeerd — sta meldingen toe in je browserinstellingen."
              : state === "on"
                ? "Ingeschakeld — je ontvangt pushmeldingen op dit apparaat."
                : "Ontvang meldingen ook als de app gesloten is."}
        </p>
      </div>
      {state === "on" ? (
        <button
          type="button"
          onClick={disable}
          className="inline-flex h-10 shrink-0 items-center rounded-xl border border-border px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Uitschakelen
        </button>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={state === "unsupported" || state === "denied" || state === "busy" || state === "loading"}
          className={cn(
            "inline-flex h-10 shrink-0 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90",
            (state === "unsupported" || state === "denied" || state === "busy" || state === "loading") &&
              "cursor-not-allowed opacity-50"
          )}
        >
          {state === "busy" ? "Bezig…" : "Inschakelen"}
        </button>
      )}
    </div>
  );
}
