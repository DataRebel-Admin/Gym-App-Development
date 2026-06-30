import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
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

export const metadata = { title: "Tenants" };

export default async function TenantsPage() {
  await requireSuperadmin();

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      accentColor: true,
      _count: { select: { users: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Tenants
        </h1>
        <Link
          href="/admin/tenants/new"
          className="rounded-lg bg-accent-gradient px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:shadow-accent"
        >
          + Nieuwe tenant
        </Link>
      </div>

      {tenants.length === 0 ? (
        <p className="text-sm text-neutral-500">Nog geen tenants.</p>
      ) : (
        <>
          {/* Mobiel: kaarten */}
          <div className="flex flex-col gap-3 md:hidden">
            {tenants.map((t) => (
              <MobileListCard key={t.id} href={`/admin/tenants/${t.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: t.accentColor ?? "#d4d4d4" }}
                    />
                    <span className="truncate font-medium text-neutral-900">{t.name}</span>
                  </span>
                  <Badge tone={t.status === "ACTIVE" ? "success" : "neutral"}>
                    {t.status === "ACTIVE" ? "Actief" : "Inactief"}
                  </Badge>
                </div>
                <p className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                  <span className="font-mono">{t.slug}</span>
                  <span>{t._count.users} gebruikers</span>
                </p>
              </MobileListCard>
            ))}
          </div>

          {/* Desktop: tabel */}
          <TableWrap className="hidden md:block">
          <Table>
            <Thead>
              <tr>
                <Th>Naam</Th>
                <Th>Slug</Th>
                <Th>Status</Th>
                <Th>Gebruikers</Th>
                <Th className="text-right" />
              </tr>
            </Thead>
            <Tbody>
              {tenants.map((t) => (
                <TableRowLink
                  key={t.id}
                  href={`/admin/tenants/${t.id}`}
                  label={`Tenant ${t.name} beheren`}
                >
                  <Td>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full ring-1 ring-inset ring-black/10"
                        style={{ backgroundColor: t.accentColor ?? "#d4d4d4" }}
                      />
                      <span className="font-medium text-neutral-900">{t.name}</span>
                    </span>
                  </Td>
                  <Td className="font-mono text-xs text-neutral-500">{t.slug}</Td>
                  <Td>
                    <Badge tone={t.status === "ACTIVE" ? "success" : "neutral"}>
                      {t.status === "ACTIVE" ? "Actief" : "Inactief"}
                    </Badge>
                  </Td>
                  <Td className="text-neutral-500">{t._count.users}</Td>
                  <Td className="text-right">
                    <span className="text-sm font-medium text-accent" aria-hidden>
                      Beheren →
                    </span>
                  </Td>
                </TableRowLink>
              ))}
            </Tbody>
          </Table>
          </TableWrap>
        </>
      )}
    </div>
  );
}
