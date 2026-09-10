import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { modeHref } from "@/lib/member-mode";
import { getMemberMode } from "@/lib/member-mode-server";
import { Dumbbell, LayoutDashboard, ChevronRight } from "@/components/ui/icons";
import { chooseMode } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("mode");
  return { title: t("metaTitle") };
}

/**
 * Keuzescherm voor een eigenaar/medewerker die óók zelf bij deze sportschool
 * sport: ga je trainen of ga je beheren? Verschijnt bij elke koude app-start
 * (de modus-cookie is een sessiecookie), tenzij "onthoud mijn keuze" aan stond.
 *
 * Wie maar één wereld heeft komt hier nooit: die wordt meteen doorgestuurd, dus
 * de route is veilig als vaste bestemming voor de "wisselen"-ingangen.
 *
 * Eén `<form>` om beide knoppen heen: de submit-knop draagt zelf `name="mode"`,
 * zodat de checkbox "onthouden" bij elke keuze meekomt en het scherm zonder
 * JavaScript werkt.
 */
export default async function StartPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { bothModes, role } = await getMemberMode();
  if (!bothModes) redirect(modeHref(role === "TENANT_MEMBER" ? "member" : "owner"));

  const [t, tenant] = await Promise.all([getTranslations("mode"), getCurrentTenant()]);
  const firstName = session.user.name?.split(" ")[0];

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="mx-auto mb-4 h-12 w-12 rounded-2xl object-contain"
            />
          ) : (
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-gradient text-lg font-bold text-accent-foreground">
              {(tenant?.name ?? "G").charAt(0)}
            </span>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            {firstName ? t("titleName", { name: firstName }) : t("title")}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">{t("subtitle")}</p>
        </div>

        <form action={chooseMode} className="flex flex-col gap-3">
          <ModeButton
            mode="member"
            title={t("train")}
            desc={t("trainDesc")}
            icon={<Dumbbell className="size-6" />}
          />
          <ModeButton
            mode="owner"
            title={t("manage")}
            desc={t("manageDesc")}
            icon={<LayoutDashboard className="size-6" />}
          />

          <label className="mt-2 flex items-center justify-center gap-2.5 text-sm text-neutral-600">
            <input
              type="checkbox"
              name="remember"
              className="size-4 rounded border-border accent-[var(--tenant-accent)]"
            />
            {t("remember")}
          </label>
          <p className="text-center text-xs text-neutral-400">{t("switchHint")}</p>
        </form>
      </div>
    </main>
  );
}

function ModeButton({
  mode,
  title,
  desc,
  icon,
}: {
  mode: "member" | "owner";
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  // Prominente keuzekaart → `rounded-3xl` + p-5: de paneelmaat uit de
  // ledenomgeving (app/member/page.tsx); een lijstrij is daar `rounded-2xl`.
  return (
    <button
      type="submit"
      name="mode"
      value={mode}
      className="group flex w-full items-center gap-4 rounded-3xl border border-border bg-surface-1 p-5 text-left shadow-sm transition-all hover:border-accent hover:bg-accent-soft focus-ring active:scale-[0.99]"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-bold text-neutral-900">
          {title}
        </span>
        <span className="block text-sm text-neutral-500">{desc}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </button>
  );
}
