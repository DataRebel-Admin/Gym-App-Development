import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "@/components/ui/icons";
import { setRequestStatus } from "./actions";
import { fmtDate } from "@/lib/schema-status";
import {
  REQUEST_STATUS_META,
  REQUEST_FILTERS,
  type RequestFilter,
} from "@/lib/schema-requests";

export async function generateMetadata() {
  const t = await getTranslations("owner.requests");
  return { title: t("metaTitle") };
}

const FILTER_ORDER: RequestFilter[] = ["new", "progress", "done", "rejected"];
const FILTER_KEY: Record<RequestFilter, string> = {
  new: "filterNew",
  progress: "filterProgress",
  done: "filterDone",
  rejected: "filterRejected",
};

function StatusButton({
  id,
  status,
  label,
  primary,
}: {
  id: string;
  status: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={setRequestStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={
          primary
            ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
            : "rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        }
      >
        {label}
      </button>
    </form>
  );
}

export default async function OwnerRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const owner = await requirePermission("schemas:manage");
  const t = await getTranslations("owner.requests");
  const tr = await getTranslations("requests");
  const { filter: rawFilter } = await searchParams;
  const filter: RequestFilter =
    rawFilter && rawFilter in REQUEST_FILTERS ? (rawFilter as RequestFilter) : "new";

  // Tellingen per filter (voor de tabs).
  const grouped = await prisma.schemaRequest.groupBy({
    by: ["status"],
    where: { tenantId: owner.tenantId },
    _count: true,
  });
  const countByStatus = new Map(grouped.map((g) => [g.status, g._count]));
  const filterCount = (f: RequestFilter) =>
    REQUEST_FILTERS[f].reduce((n, s) => n + (countByStatus.get(s) ?? 0), 0);

  const requests = await prisma.schemaRequest.findMany({
    where: { tenantId: owner.tenantId, status: { in: REQUEST_FILTERS[filter] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      goal: true,
      description: true,
      notes: true,
      preferredStart: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("desc")}
        </p>
      </div>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-2">
        {FILTER_ORDER.map((f) => {
          const active = f === filter;
          const count = filterCount(f);
          return (
            <Link
              key={f}
              href={`/owner/requests?filter=${f}`}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {tr(FILTER_KEY[f])}
              <span className={active ? "opacity-80" : "text-neutral-400"}>{count}</span>
            </Link>
          );
        })}
      </nav>

      {requests.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-7 text-accent" />}
          title={t("empty")}
          description={t("emptyDesc")}
        />
      ) : (
        <ul className="flex max-w-3xl flex-col gap-3">
          {requests.map((r) => {
            const meta = REQUEST_STATUS_META[r.status];
            return (
              <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-neutral-900">
                    {r.user.name ?? r.user.email}
                  </span>
                  <Badge tone={meta.tone}>{tr(`status${r.status}`)}</Badge>
                  <span className="text-xs text-neutral-500">
                    {t("goalDate", { goal: tr(`goal${r.goal}`), date: fmtDate(r.createdAt) })}
                    {r.preferredStart ? t("startDate", { date: fmtDate(r.preferredStart) }) : ""}
                  </span>
                </div>

                {r.description ? (
                  <p className="text-sm text-neutral-700">{r.description}</p>
                ) : null}
                {r.notes ? (
                  <p className="text-sm text-neutral-500">
                    <span className="font-medium">{t("notes")}</span>
                    {r.notes}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                  <Link
                    href={`/owner/schemas/members/${r.userId}`}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
                  >
                    {t("createSchema")}
                  </Link>
                  {r.status === "NEW" ? (
                    <StatusButton id={r.id} status="IN_PROGRESS" label={t("takeInProgress")} />
                  ) : null}
                  {(r.status === "NEW" || r.status === "IN_PROGRESS") ? (
                    <StatusButton id={r.id} status="SCHEMA_CREATED" label={t("schemaCreated")} />
                  ) : null}
                  {(r.status === "IN_PROGRESS" || r.status === "SCHEMA_CREATED") ? (
                    <StatusButton id={r.id} status="COMPLETED" label={t("complete")} primary />
                  ) : null}
                  {(r.status === "NEW" || r.status === "IN_PROGRESS") ? (
                    <StatusButton id={r.id} status="REJECTED" label={t("reject")} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
