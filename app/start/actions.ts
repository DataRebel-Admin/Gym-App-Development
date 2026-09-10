"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  MODE_COOKIE,
  MODE_COOKIE_REMEMBER_MAX_AGE,
} from "@/lib/constants";
import { modeHref, parseMode } from "@/lib/member-mode";
import { getMemberMode } from "@/lib/member-mode-server";

/**
 * Zet de app-modus van een teamlid dat óók zelf sport en stuurt door naar de
 * bijbehorende omgeving. Gebruikt door het keuzescherm `/start` én door de
 * "wisselen"-ingangen in de menu's.
 *
 * Zonder "onthouden" is het een **sessiecookie**: de volgende koude app-start
 * toont het keuzescherm opnieuw. Met onthouden een jaar (patroon van de andere
 * per-device voorkeuren, zie lib/constants.ts).
 */
export async function chooseMode(formData: FormData) {
  const mode = parseMode(formData.get("mode")?.toString());
  const remember = formData.get("remember") === "on";

  // Autoritatief: alleen wie écht beide werelden heeft mag hier een modus kiezen.
  const { bothModes, role } = await getMemberMode();
  if (!bothModes) {
    redirect(role === "TENANT_MEMBER" ? "/member" : "/owner");
  }
  if (!mode) redirect("/start");

  (await cookies()).set(MODE_COOKIE, mode, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: MODE_COOKIE_REMEMBER_MAX_AGE } : {}),
  });

  redirect(modeHref(mode));
}
