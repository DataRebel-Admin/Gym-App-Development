import Link from "next/link";
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

export const metadata = { title: "Audit logs" };

export default async function OwnerAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const owner = await requireOwner();
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
    <div className="flex flex-col gap-6 px-6 py-8">
      <SectionHeading
        title="Audit log"
        description="Wie heeft wat gedaan, en wanneer — binnen jouw sportschool."
        action={
          <>
            <a className={buttonClasses({ variant: "outline", size: "sm" })} href={exportQs("csv")}>
              Export CSV
            </a>
            <a className={buttonClasses({ variant: "outline", size: "sm" })} href={exportQs("pdf")}>
              Export PDF
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
          {result.total} regels · pagina {result.page} / {result.totalPages}
        </span>
        <div className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={pageHref(result.page - 1)}>
              ← Vorige
            </Link>
          ) : null}
          {result.page < result.totalPages ? (
            <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={pageHref(result.page + 1)}>
              Volgende →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
