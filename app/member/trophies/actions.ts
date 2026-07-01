"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/member";
import { markCelebrated } from "@/lib/achievements/evaluate";

/**
 * Markeer behaalde-maar-nog-niet-gevierde trofeeën als getoond (na de
 * celebration-overlay). Zonder `ids` worden alle openstaande gemarkeerd.
 */
export async function dismissCelebrations(ids?: string[]): Promise<void> {
  const member = await requireMember();
  await markCelebrated(member.id, member.tenantId, ids);
  revalidatePath("/member");
  revalidatePath("/member/trophies");
}
