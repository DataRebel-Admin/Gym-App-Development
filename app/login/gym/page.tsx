import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyTenantSelection } from "@/lib/login-challenge";
import { GYM_SELECT_COOKIE } from "@/lib/constants";
import { selectGym } from "../actions";

export const metadata = { title: "Kies je sportschool" };

/**
 * Gym-kiezer voor leden die met hetzelfde e-mailadres bij meerdere sportscholen
 * horen. Alleen bereikbaar met een geldig, proof-getekend keuze-token (gezet ná
 * een correcte wachtwoord-check in `loginWithPassword`). Zonder token → login.
 * UI hardcoded NL (precedent: nieuwere features).
 */
export default async function GymPickerPage() {
  const token = (await cookies()).get(GYM_SELECT_COOKIE)?.value;
  const claims = token ? verifyTenantSelection(token) : null;
  if (!claims) redirect("/login");

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: claims.tenantIds }, status: "ACTIVE", deletedAt: null },
    select: { slug: true, name: true, logoUrl: true, accentColor: true },
    orderBy: { name: "asc" },
  });
  if (tenants.length === 0) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-1 p-8 shadow-md">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            Kies je sportschool
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Je hoort bij meerdere sportscholen. Kies waar je wilt inloggen.
          </p>
        </div>

        <ul className="flex flex-col gap-2.5">
          {tenants.map((t) => (
            <li key={t.slug}>
              <form action={selectGym}>
                <input type="hidden" name="slug" value={t.slug} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-0 px-4 py-3 text-left transition-colors hover:bg-neutral-100 focus-ring active:scale-[0.99]"
                >
                  {t.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.logoUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl object-contain"
                    />
                  ) : (
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
                      style={{ backgroundColor: t.accentColor ?? "#e84b1f" }}
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-neutral-900">
                      {t.name}
                    </span>
                    <span className="block text-xs text-neutral-500">Inloggen</span>
                  </span>
                  <svg
                    viewBox="0 0 16 16"
                    className="size-4 shrink-0 text-neutral-400"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M6 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </form>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-center text-xs text-neutral-500">
          <Link href="/login" className="font-medium hover:text-neutral-900">
            Terug naar inloggen
          </Link>
        </p>
      </div>
    </main>
  );
}
