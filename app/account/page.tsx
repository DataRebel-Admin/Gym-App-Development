import { getTranslations } from "next-intl/server";
import { requireAccount } from "@/lib/account";
import { accountSectionsRaw, ACCOUNT_ICON, type AccountGroup } from "@/lib/account-sections";
import { AccountHub } from "@/components/account/account-hub";

export const metadata = { title: "Accountinstellingen" };

export default async function AccountHubPage() {
  const me = await requireAccount();
  const t = await getTranslations("account");

  const groups: AccountGroup[] = accountSectionsRaw(me.role).map((g) => ({
    key: g.key,
    label: t(g.labelKey),
    items: g.items.map((it) => ({
      href: it.href,
      label: t(it.labelKey),
      desc: t(it.descKey),
      iconPath: ACCOUNT_ICON[it.icon],
    })),
  }));

  return <AccountHub title={t("title")} groups={groups} />;
}
