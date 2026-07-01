import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/owner";
import {
  queryAuditLogs,
  getAuditActors,
  parseAuditSearchParams,
  serializeAuditRows,
} from "@/lib/audit-query";
import { SectionHeading } from "@/components/ui/section-heading";
import { buttonClasses } from "@/components/ui/button-classes";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditList } from "@/components/audit/audit-list";

export async function generateMetadata() {
  const t = await getTranslations("owner.audit");
  return { title: t("metaTitle") };
}

export default async function OwnerAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const owner = await requireOwner();
  const t = await getTranslations("owner.audit");
  const sp = await searchParams;
  const { filters, page } = parseAuditSearchParams(sp);

  const [result, actors] = await Promise.all([
    queryAuditLogs({ tenantId: owner.tenantId, filters, page }),
    getAuditActors(owner.tenantId),
  ]);
  const rows = serializeAuditRows(result.rows);

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][]
  );
  const exportQs = (format: string) => {
    const p = new URLSearchParams(qs);
    p.set("format", format);
    return `/owner/audit/export?${p.toString()}`;
  };
  const pageHref = (p: number) => {
    const params = new URLSearchParams(qs);
    params.set("page", String(p));
    return `/owner/audit?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title={t("title")}
        description={t("desc")}
        action={
          <>
            <a className={buttonClasses({ variant: "outline", size: "sm" })} href={exportQs("csv")}>
              {t("exportCsv")}
            </a>
            <a className={buttonClasses({ variant: "outline", size: "sm" })} href={exportQs("pdf")}>
              {t("exportPdf")}
            </a>
          </>
        }
      />

      <AuditFilters actors={actors} />

      <div className="rounded-2xl border border-border bg-surface-1 p-2 shadow-sm">
        <AuditList rows={rows} />
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          {t("summary", { total: result.total, page: result.page, totalPages: result.totalPages })}
        </span>
        <div className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={pageHref(result.page - 1)}>
              {t("prev")}
            </Link>
          ) : null}
          {result.page < result.totalPages ? (
            <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={pageHref(result.page + 1)}>
              {t("next")}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
