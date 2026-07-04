"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { machineTypeLabel, MACHINE_TYPES } from "@/lib/machine";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { QrCode, Dumbbell } from "@/components/ui/icons";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
} from "@/components/ui/table";
import type { MachineStatus } from "@prisma/client";
import type { MaintenanceLevel } from "@/lib/maintenance";
import { MachineStatusBadge } from "@/components/maintenance/status-badge";
import { QrExportDialog, type PreviewMachine } from "@/components/qr-export/qr-export-dialog";

export type MachineRow = {
  id: string;
  number: number;
  name: string;
  type: string;
  category: string;
  imageUrl: string | null;
  hasQr: boolean;
  location: string | null;
  serialNumber: string | null;
  status: MachineStatus;
  level: MaintenanceLevel;
  scanCount: number;
  scansThisWeek: number;
};

type SortKey = "name" | "type" | "scans";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actief",
  MAINTENANCE_DUE: "Onderhoud nodig",
  IN_MAINTENANCE: "In onderhoud",
  OUT_OF_SERVICE: "Buiten gebruik",
};

export function MachinesTable({
  machines,
  showStatus = true,
  canManage = true,
  exportEndpoint,
}: {
  machines: MachineRow[];
  /** Onderhoudsmodule uit → verberg de onderhouds-statuskolom. */
  showStatus?: boolean;
  /** Alleen de eigenaar mag machines bewerken/toevoegen. */
  canManage?: boolean;
  /** Route-endpoint voor de QR-bulkexport. */
  exportEndpoint: string;
}) {
  const t = useTranslations("owner.machines");
  const typeLabel = (type: string) => {
    const key = `type${type}`;
    const label = t(key);
    return label === `owner.machines.${key}` ? machineTypeLabel(type) : label;
  };

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);

  // Unieke locaties voor het filter.
  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const m of machines) if (m.location?.trim()) set.add(m.location.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [machines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = machines.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      if (statusFilter && m.status !== statusFilter) return false;
      if (locationFilter && (m.location ?? "") !== locationFilter) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sort === "scans") return b.scanCount - a.scanCount;
      if (sort === "type")
        return machineTypeLabel(a.type).localeCompare(machineTypeLabel(b.type));
      return a.name.localeCompare(b.name);
    });
  }, [machines, query, typeFilter, statusFilter, locationFilter, sort]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const m of filtered) next.delete(m.id);
      } else {
        for (const m of filtered) next.add(m.id);
      }
      return next;
    });
  }

  const toPreview = (m: MachineRow): PreviewMachine => ({
    id: m.id,
    name: m.name,
    number: m.number,
    category: m.category,
  });

  const selectedRows = machines.filter((m) => selected.has(m.id));

  const colCount = 4 + (showStatus ? 1 : 0) + (canManage ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Filterbalk */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="max-w-xs"
        />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
          <option value="">Alle types</option>
          {MACHINE_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {typeLabel(tp)}
            </option>
          ))}
        </Select>
        {showStatus ? (
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option value="">Alle statussen</option>
            {Object.entries(STATUS_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        ) : null}
        {locations.length > 0 ? (
          <Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-auto">
            <option value="">Alle locaties</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </Select>
        ) : null}
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto">
          <option value="name">{t("sortName")}</option>
          <option value="type">{t("sortType")}</option>
          <option value="scans">Meeste scans</option>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
            >
              Selectie wissen ({selected.size})
            </button>
          ) : null}
          <Button
            onClick={() => setExportOpen(true)}
            disabled={machines.length === 0}
            variant="primary"
          >
            <QrCode className="size-4" />
            QR-codes downloaden
          </Button>
        </div>
      </div>

      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Alles selecteren"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  className="size-4 accent-[var(--tenant-accent)]"
                />
              </Th>
              <Th>{t("colMachine")}</Th>
              <Th>{t("colType")}</Th>
              {showStatus ? <Th>Status</Th> : null}
              <Th>{t("colQr")}</Th>
              <Th>Scans</Th>
              {canManage ? <Th className="text-right" /> : null}
            </tr>
          </Thead>
          <Tbody>
            {filtered.map((m) => (
              <Tr key={m.id} className={selected.has(m.id) ? "bg-accent-soft/40" : undefined}>
                <Td>
                  <input
                    type="checkbox"
                    aria-label={`${m.name} selecteren`}
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="size-4 accent-[var(--tenant-accent)]"
                  />
                </Td>
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
                    <div className="min-w-0">
                      <span className="font-medium text-neutral-900">{m.name}</span>
                      <p className="text-xs text-neutral-400">
                        Nr. {m.number}
                        {m.location ? ` · ${m.location}` : ""}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td className="text-neutral-500">{typeLabel(m.type)}</Td>
                {showStatus ? (
                  <Td>
                    <MachineStatusBadge status={m.status} level={m.level} />
                  </Td>
                ) : null}
                <Td>
                  {m.hasQr ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </Td>
                <Td>
                  <span className="font-medium text-neutral-900 tabular-nums">
                    {m.scanCount}
                  </span>
                  {m.scansThisWeek > 0 ? (
                    <span className="ml-1.5 text-xs font-medium text-green-600">
                      ↑ {m.scansThisWeek}
                    </span>
                  ) : null}
                </Td>
                {canManage ? (
                  <Td className="text-right">
                    <Link
                      href={`/owner/machines/${m.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {t("edit")}
                    </Link>
                  </Td>
                ) : null}
              </Tr>
            ))}
            {filtered.length === 0 ? (
              <Tr>
                <Td colSpan={colCount} className="py-8 text-center text-neutral-500">
                  {t("noMachines")}
                </Td>
              </Tr>
            ) : null}
          </Tbody>
        </Table>
      </TableWrap>

      <QrExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        endpoint={exportEndpoint}
        selected={selectedRows.map(toPreview)}
        filtered={filtered.map(toPreview)}
        all={machines.map(toPreview)}
      />
    </div>
  );
}
