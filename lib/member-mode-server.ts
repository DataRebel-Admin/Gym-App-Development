import "server-only";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isTeamRole } from "@/lib/member-mode";

/**
 * Serverkant van de lid-modus: de vlag `User.trainsAsMember` ophalen voor de
 * ingelogde gebruiker. De regels zelf staan in het pure lib/member-mode.ts.
 */

export type MemberModeState = {
  role: Role | null;
  /** De rauwe vlag `User.trainsAsMember` (false voor niet-teamrollen). */
  trainsAsMember: boolean;
  /** Mag deze gebruiker `/member` gebruiken? */
  canTrain: boolean;
  /** Teamlid dat óók sport → toon de wissel-ingangen en het keuzescherm. */
  bothModes: boolean;
};

const GUEST: MemberModeState = {
  role: null,
  trainsAsMember: false,
  canTrain: false,
  bothModes: false,
};

/**
 * De lid-modus-staat van de ingelogde gebruiker, per request gecachet.
 *
 * De DB-lookup draait **alleen** voor teamrollen: een gewoon lid (verreweg het
 * meeste verkeer in de member-area) kost hier geen extra query. De vlag staat
 * bewust niet in de JWT — dan zou hij verouderen tot de volgende login, terwijl
 * de eigenaar 'm net heeft omgezet.
 */
export const getMemberMode = cache(async (): Promise<MemberModeState> => {
  const session = await auth();
  const user = session?.user;
  if (!user) return GUEST;
  const { role } = user;
  if (role === "TENANT_MEMBER") {
    return { role, trainsAsMember: false, canTrain: true, bothModes: false };
  }
  if (!isTeamRole(role)) {
    return { role, trainsAsMember: false, canTrain: false, bothModes: false };
  }

  const trains = await teamTrainsAsMember(user.id);
  return { role, trainsAsMember: trains, canTrain: trains, bothModes: trains };
});

/** Rauwe vlag van één teamlid (per request gecachet op id). */
const teamTrainsAsMember = cache(async (userId: string): Promise<boolean> => {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { trainsAsMember: true },
  });
  return row?.trainsAsMember === true;
});

/**
 * Is de huidige gebruiker een teamlid dat zelf sport? Gebruikt door regels die
 * voor het eigen team anders liggen dan voor leden (zie `memberSchemaModeFor`).
 */
export async function isTrainingTeamMember(): Promise<boolean> {
  const state = await getMemberMode();
  return state.bothModes;
}
