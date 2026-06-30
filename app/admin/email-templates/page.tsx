import { requireSuperadmin } from "@/lib/superadmin";
import { listTemplates } from "@/lib/email/template-store";
import { getTemplateDef } from "@/lib/email/template-defaults";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Td,
} from "@/components/ui/table";
import { TableRowLink } from "@/components/ui/table-row-link";
import { MobileListCard } from "@/components/ui/mobile-list-card";

export const metadata = { title: "E-mailtemplates" };

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function EmailTemplatesPage() {
  await requireSuperadmin();
  const templates = await listTemplates();

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title="E-mailtemplates"
        description="Beheer alle systeemmails: bewerk de inhoud, preview met de huisstijl van een sportschool, verstuur een testmail en publiceer — zonder herdeploy. De gebrande koptekst, footer en kleuren worden per tenant automatisch toegevoegd."
      />

      {/* Mobiel: kaarten */}
      <div className="flex flex-col gap-3 md:hidden">
        {templates.map((t) => {
          const def = getTemplateDef(t.key);
          const published = t.status === "PUBLISHED" && t.publishedAt != null;
          return (
            <MobileListCard key={t.id} href={`/admin/email-templates/${t.key}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{def?.name ?? t.key}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">
                    {def?.description ?? "—"}
                  </p>
                </div>
                {published ? (
                  <Badge tone="success">Actief</Badge>
                ) : (
                  <Badge tone="warning">Concept</Badge>
                )}
              </div>
              <p className="mt-3 text-xs text-neutral-400">
                Gewijzigd {DATE_FMT.format(t.updatedAt)}
                {t.updatedByEmail ? ` · ${t.updatedByEmail}` : ""}
              </p>
            </MobileListCard>
          );
        })}
      </div>

      {/* Desktop: tabel */}
      <TableWrap className="hidden md:block">
        <Table>
          <Thead>
            <tr>
              <Th>Template</Th>
              <Th>Omschrijving</Th>
              <Th>Laatst gewijzigd</Th>
              <Th>Door</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {templates.map((t) => {
              const def = getTemplateDef(t.key);
              const published = t.status === "PUBLISHED" && t.publishedAt != null;
              return (
                <TableRowLink
                  key={t.id}
                  href={`/admin/email-templates/${t.key}`}
                  label={`Template '${def?.name ?? t.key}' bewerken`}
                >
                  <Td>
                    <span className="font-medium text-neutral-900">
                      {def?.name ?? t.key}
                    </span>
                    {def && !def.hasTrigger ? (
                      <span className="ml-2 align-middle text-[11px] text-neutral-400">
                        geen automatische trigger
                      </span>
                    ) : null}
                  </Td>
                  <Td className="max-w-md text-neutral-500">
                    {def?.description ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-neutral-500">
                    {DATE_FMT.format(t.updatedAt)}
                  </Td>
                  <Td className="text-neutral-500">
                    {t.updatedByEmail ?? <span className="text-neutral-400">—</span>}
                  </Td>
                  <Td>
                    {published ? (
                      <Badge tone="success">Actief</Badge>
                    ) : (
                      <Badge tone="warning">Concept</Badge>
                    )}
                  </Td>
                </TableRowLink>
              );
            })}
          </Tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
