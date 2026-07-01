import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { setAiEnabled } from "./actions";
import { TenantContactForm, type ContactInitial } from "@/components/tenant-contact-form";

function startOfMonth(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

export async function generateMetadata() {
  const t = await getTranslations("owner.settings");
  return { title: t("metaTitle") };
}

export default async function SettingsPage() {
  const owner = await requireOwner();
  const t = await getTranslations("owner.settings");

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: owner.tenantId },
    select: {
      name: true,
      aiEnabled: true,
      addressLine: true,
      postalCode: true,
      city: true,
      country: true,
      contactPhone: true,
      contactEmail: true,
      website: true,
      openingHours: true,
      socials: true,
    },
  });

  const asMap = (v: unknown): Record<string, string> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string") out[k] = val;
    }
    return out;
  };

  const contactInitial: ContactInitial = {
    addressLine: tenant.addressLine ?? "",
    postalCode: tenant.postalCode ?? "",
    city: tenant.city ?? "",
    country: tenant.country ?? "",
    contactPhone: tenant.contactPhone ?? "",
    contactEmail: tenant.contactEmail ?? "",
    website: tenant.website ?? "",
    hours: asMap(tenant.openingHours),
    socials: asMap(tenant.socials),
  };

  const questionsThisMonth = await prisma.aiUsage.count({
    where: { tenantId: owner.tenantId, createdAt: { gte: startOfMonth() } },
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        {t("title")}
      </h1>

      <section className="flex max-w-2xl flex-col gap-4 rounded-xl border border-neutral-200 p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            {t("aiTitle")}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {t.rich("aiDesc", {
              status: () => (
                <span className="font-medium text-neutral-900">
                  {tenant.aiEnabled ? t("statusOn") : t("statusOff")}
                </span>
              ),
            })}
          </p>
        </div>

        <form action={setAiEnabled}>
          <input
            type="hidden"
            name="enabled"
            value={tenant.aiEnabled ? "false" : "true"}
          />
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tenant.aiEnabled
                ? "border border-neutral-300 text-neutral-900 hover:bg-neutral-50"
                : "bg-accent text-accent-foreground hover:opacity-90"
            }`}
          >
            {tenant.aiEnabled ? t("turnOff") : t("turnOn")}
          </button>
        </form>

        <div className="rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {t("questionsThisMonth")}{" "}
          <span className="font-semibold text-neutral-900">
            {questionsThisMonth}
          </span>{" "}
          <span className="text-neutral-500">{t("forCostMonitoring")}</span>
        </div>
      </section>

      <section className="flex max-w-2xl flex-col gap-4 rounded-xl border border-neutral-200 p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{t("contactTitle")}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {t.rich("contactDesc", {
              b: (c) => <span className="font-medium text-neutral-900">{c}</span>,
            })}
          </p>
        </div>
        <TenantContactForm initial={contactInitial} />
      </section>
    </div>
  );
}
