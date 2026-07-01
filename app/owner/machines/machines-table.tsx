"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { machineTypeLabel } from "@/lib/machine";
import { Input, Select } from "@/components/ui/field";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
} from "@/components/ui/table";
import { Dumbbell } from "@/components/ui/icons";

export type MachineRow = {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
  hasQr: boolean;
};

type SortKey = "name" | "type";

export function MachinesTable({ machines }: { machines: MachineRow[] }) {
  const t = useTranslations("owner.machines");
  const typeLabel = (type: string) => {
    const key = `type${type}`;
    const label = t(key);
    // Onbekend type → val terug op de registry-helper.
    return label === `owner.machines.${key}` ? machineTypeLabel(type) : label;
  };
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? machines.filter((m) => m.name.toLowerCase().includes(q))
      : machines;
    return [...filtered].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : machineTypeLabel(a.type).localeCompare(machineTypeLabel(b.type))
    );
  }, [machines, query, sort]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="max-w-xs"
        />
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="w-auto"
        >
          <option value="name">{t("sortName")}</option>
          <option value="type">{t("sortType")}</option>
        </Select>
      </div>

      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th>{t("colMachine")}</Th>
              <Th>{t("colType")}</Th>
              <Th>{t("colQr")}</Th>
              <Th className="text-right" />
            </tr>
          </Thead>
          <Tbody>
            {rows.map((m) => (
              <Tr key={m.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    {m.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.imageUrl}
                        alt={m.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                        <Dumbbell className="size-5" />
                      </div>
                    )}
                    <span className="font-medium text-neutral-900">{m.name}</span>
                  </div>
                </Td>
                <Td className="text-neutral-500">{typeLabel(m.type)}</Td>
                <Td>
                  {m.hasQr ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/owner/machines/${m.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {t("edit")}
                  </Link>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 ? (
              <Tr>
                <Td colSpan={4} className="py-8 text-center text-neutral-500">
                  {t("noMachines")}
                </Td>
              </Tr>
            ) : null}
          </Tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
