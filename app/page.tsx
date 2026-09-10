import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MODE_COOKIE } from "@/lib/constants";
import { modeHref, resolveOpenMode } from "@/lib/member-mode";
import { getMemberMode } from "@/lib/member-mode-server";
import { buttonClasses } from "@/components/ui/button-classes";
import { GymRebelStacked } from "@/components/brand/gymrebel-logo";
import { GetTheApp } from "@/components/pwa/get-the-app";

export const metadata = { title: "Welkom" };

export default async function Home() {
  // Na login landt de magic link hier; stuur door op basis van rol. Dit is het
  // enige trechterpunt (elke signIn gebruikt `redirectTo: "/"`) én het pad waar
  // de native app op koud opstarten binnenkomt — dus hier valt ook de keuze
  // "trainen of beheren" voor een teamlid dat zelf meesport.
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "SUPERADMIN") redirect("/admin");
    const { trainsAsMember } = await getMemberMode();
    const mode = resolveOpenMode(
      session.user.role,
      trainsAsMember,
      (await cookies()).get(MODE_COOKIE)?.value
    );
    redirect(mode === "choose" ? "/start" : modeHref(mode));
  }

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Zachte accent-gloed op de achtergrond */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent-gradient)" }}
      />
      {/* Platformmerk (pre-tenant): hier is GymRebel zélf de afzender, dus het
          echte logo i.p.v. een initiaal-tegel. De <h1> blijft staan voor
          screenreaders/SEO; visueel doet het woordmerk het werk. */}
      <GymRebelStacked className="w-64 max-w-full text-neutral-900 sm:w-80" />
      <h1 className="sr-only">GymRebel Training</h1>
      <p className="mt-4 max-w-md text-lg text-neutral-500">
        Slimmer trainen in jouw sportschool.
      </p>
      <Link href="/login" className={buttonClasses({ size: "lg", className: "mt-8" })}>
        Inloggen
      </Link>
      {/* Installeren of downloaden — verbergt zichzelf in de native app, in een
          reeds geïnstalleerde PWA, en zolang er niets te bieden valt. */}
      <GetTheApp />
    </main>
  );
}
