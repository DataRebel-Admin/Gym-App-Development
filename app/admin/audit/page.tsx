import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
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

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSuperadmin();
  const sp = await searchParams;
  const { filters, tenantParam, page } = parseAuditSearchParams(sp);

  const [result, actors, tenants] = await Promise.all([
    queryAuditLogs({ tenantId: tenantParam, filters, page }),
    getAuditActors(undefined),
    prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
  const rows = serializeAuditRows(result.rows, tenantName);

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][]
  );
  const exportQs = (format: string) => {
    const p = new URLSearchParams(qs);
    p.set("format", format);
    return `/admin/audit/export?${p.toString()}`;
  };
  const pageHref = (p: number) => {
    const params = new URLSearchParams(qs);
    params.set("page", String(p));
    return `/admin/audit?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <SectionHeading
        title="Audit log — platform"
        description="Alle gebeurtenissen over alle tenants."
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

      <AuditFilters actors={actors} tenants={tenants} />

      <div className="rounded-2xl border border-border bg-surface-1 p-2 shadow-sm">
        <AuditList rows={rows} showTenant />
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
