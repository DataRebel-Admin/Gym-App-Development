import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/**
 * Gedeelde kaart voor één instelling op /owner/settings. Bewust dekkend
 * (`bg-surface-1`): de pagina staat op de aurora-achtergrond, een doorzichtige
 * kaart met doorzichtige velden leest onrustig.
 */
export function SettingsSection({
  title,
  description,
  status,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  /** Badge naast de titel, bijvoorbeeld de huidige modus. */
  status?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex max-w-2xl flex-col gap-4 rounded-xl border border-border bg-surface-1 p-5",
        className
      )}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {status}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Instelling met één aan/uit-schakelaar. De stand is op drie manieren af te
 * lezen: badge naast de titel, de stand van de schakelaar en het bijschrift
 * eronder. De schakelaar is een gewone submit-knop, zodat de sectie een Server
 * Component blijft (geen client-JS voor een toggle).
 */
export async function SettingToggleSection({
  title,
  description,
  enabled,
  action,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  enabled: boolean;
  action: (formData: FormData) => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const t = await getTranslations("owner.settings");
  const onLabel = t("toggleOn");
  const offLabel = t("toggleOff");

  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-xl border border-border bg-surface-1 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
            <Badge tone={enabled ? "success" : "neutral"}>
              {enabled ? onLabel : offLabel}
            </Badge>
          </div>
          {description ? (
            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          ) : null}
        </div>

        <form action={action} className="flex shrink-0 flex-col items-center gap-1">
          <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
          <button
            type="submit"
            role="switch"
            aria-checked={enabled}
            aria-label={
              enabled
                ? t("toggleAriaDisable", { name: title })
                : t("toggleAriaEnable", { name: title })
            }
            className={`focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              enabled ? "bg-accent" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
          <span
            aria-hidden
            className={`text-xs font-medium ${
              enabled ? "text-neutral-700" : "text-neutral-400"
            }`}
          >
            {enabled ? onLabel : offLabel}
          </span>
        </form>
      </div>

      {children}
    </section>
  );
}
