import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { getTenantFeatures } from "@/lib/features/service";
import {
  setAiEnabled,
  setAchievementsEnabled,
  setQuotesEnabled,
  setClassesEnabled,
  setMemberCanEditAssigned,
} from "./actions";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  SettingsSection,
  SettingToggleSection,
} from "@/components/owner/settings-section";
import { TenantContactForm, type ContactInitial } from "@/components/tenant-contact-form";
import { MemberSchemaModeForm } from "@/components/owner/member-schema-mode-form";
import { MeasurementFieldsForm } from "@/components/owner/measurement-fields-form";
import { QuotesForm } from "@/components/owner/quotes-form";
import { parseEnabledMetricKeys } from "@/lib/measurement-meta";
import { ContactSupportButton } from "@/components/support/contact-support-button";
import { parseCustomQuotes } from "@/lib/workout-quotes";
import { setDefectReminderDays } from "@/app/owner/defects/actions";

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
      achievementsEnabled: true,
      quotesEnabled: true,
      classesEnabled: true,
      enabledMeasurementFields: true,
      customQuotes: true,
      memberSchemaMode: true,
      memberCanEditAssigned: true,
      defectReminderDays: true,
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

  // Feature-flags (Superadmin): een uitgeschakelde module verbergt ook z'n
  // owner-instelling — de eigenaar kan 'm dan niet zelf heractiveren.
  const features = await getTenantFeatures(owner.tenantId);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        {t("title")}
      </h1>

      {features.ai ? (
        <SettingToggleSection
          title={t("aiTitle")}
          description={t("aiDesc")}
          enabled={tenant.aiEnabled}
          action={setAiEnabled}
        >
          <div className="rounded-lg border border-border bg-surface-0 px-4 py-3 text-sm text-neutral-600">
            {t("questionsThisMonth")}{" "}
            <span className="font-semibold text-neutral-900">
              {questionsThisMonth}
            </span>{" "}
            <span className="text-neutral-500">{t("forCostMonitoring")}</span>
          </div>
        </SettingToggleSection>
      ) : null}

      <SettingToggleSection
        title="Trofeeën & mijlpalen"
        description="Beloon je leden met trofeeën, een Gym Passport en automatisch gevierde mijlpalen."
        enabled={tenant.achievementsEnabled}
        action={setAchievementsEnabled}
      />

      <SettingToggleSection
        title="Workout Quotes"
        description="Toon je leden een korte motiverende quote na een afgeronde training."
        enabled={tenant.quotesEnabled}
        action={setQuotesEnabled}
      >
        <QuotesForm initial={parseCustomQuotes(tenant.customQuotes)} />
      </SettingToggleSection>

      {features.group_classes ? (
        <SettingToggleSection
          title="Lesrooster"
          description="Laat leden zich aanmelden voor groepslessen. Uitschakelen verbergt het rooster voor leden en medewerkers; bestaande lessen en aanmeldingen blijven behouden."
          enabled={tenant.classesEnabled}
          action={setClassesEnabled}
        />
      ) : null}

      {features.defects ? (
        <SettingsSection
          title="Apparaatdefecten"
          description="Een open defectmelding die langer dan deze termijn openstaat, komt als achterstand terug in de dagelijkse samenvatting."
        >
          <form action={setDefectReminderDays} className="flex items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              Achterstand-termijn (dagen)
              <span className="block w-28">
                <Input
                  type="number"
                  name="days"
                  min={1}
                  max={90}
                  defaultValue={tenant.defectReminderDays}
                  fieldSize="sm"
                />
              </span>
            </label>
            <button
              type="submit"
              className="h-9 rounded-lg border border-border bg-surface-1 px-4 text-sm font-medium text-neutral-900 hover:bg-surface-2"
            >
              Opslaan
            </button>
          </form>
        </SettingsSection>
      ) : null}

      <SettingsSection
        title={t("memberSchemaTitle")}
        status={
          <Badge tone={tenant.memberSchemaMode === "DISABLED" ? "neutral" : "success"}>
            {t(`memberSchemaMode${tenant.memberSchemaMode}`)}
          </Badge>
        }
        description={t("memberSchemaDesc")}
      >
        <MemberSchemaModeForm current={tenant.memberSchemaMode} />
      </SettingsSection>

      <SettingToggleSection
        title="Toegewezen schema's laten aanpassen"
        description={
          <>
            Laat leden het schema aanpassen dat jij hén hebt toegewezen, bijvoorbeeld
            een oefening ruilen als een apparaat bezet is. Ze bewerken hun eigen versie;
            jouw sjabloon blijft ongewijzigd en je ziet de aanpassing terug bij het
            schema. Deze instelling staat los van &ldquo;zelf een schema
            samenstellen&rdquo;.
          </>
        }
        enabled={tenant.memberCanEditAssigned}
        action={setMemberCanEditAssigned}
      />

      <SettingsSection
        title="Meetvelden"
        description="Kies welke lichaamsmetingen jouw sportschool gebruikt. Niet-geselecteerde velden verdwijnen uit de formulieren, grafieken en overzichten, voor trainers én leden."
      >
        <MeasurementFieldsForm enabled={parseEnabledMetricKeys(tenant.enabledMeasurementFields)} />
      </SettingsSection>

      <SettingsSection
        title={t("contactTitle")}
        description={t.rich("contactDesc", {
          b: (c) => <span className="font-medium text-neutral-900">{c}</span>,
        })}
      >
        <TenantContactForm initial={contactInitial} />
      </SettingsSection>

      <SettingsSection title={t("supportTitle")} description={t("supportDesc")}>
        <ContactSupportButton
          initial={{
            name: owner.name ?? "",
            email: owner.email ?? "",
            gymName: tenant.name,
          }}
        />
      </SettingsSection>
    </div>
  );
}
