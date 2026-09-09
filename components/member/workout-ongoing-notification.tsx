"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  clearOngoingWorkoutNotification,
  showOngoingWorkoutNotification,
} from "@/lib/workout-notifications";

/**
 * Synchroniseert de blijvende (ongoing) "training bezig"-notificatie in de
 * native app met de serverstaat: loopt er een sessie, dan staat de melding er
 * (met meelopende chronometer, tik = terug naar de actieve training); is de
 * sessie afgerond/geannuleerd/verlopen, dan ruimt de eerstvolgende render 'm
 * op. Gemount in de member-layout naast de ActiveWorkoutBar — de layout
 * rendert bij élke navigatie server-side opnieuw, dus de melding volgt de
 * werkelijkheid vanzelf. Op web/PWA doet dit niets (geen ongoing-notificaties);
 * daar is de sticky balk de tegenhanger.
 */
export function WorkoutOngoingNotification({ startedAt }: { startedAt: string | null }) {
  const t = useTranslations("member.active");
  const title = t("ongoingNotifTitle");
  const text = t("ongoingNotifText");

  useEffect(() => {
    if (!startedAt) {
      void clearOngoingWorkoutNotification();
      return;
    }
    void showOngoingWorkoutNotification({
      title,
      text,
      startedAtMs: new Date(startedAt).getTime(),
    });
  }, [startedAt, title, text]);

  return null;
}
