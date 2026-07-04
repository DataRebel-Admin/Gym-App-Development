"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/ui/icons";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
} from "@/components/ui/table";
import { QrExportDialog, type PreviewMachine } from "@/components/qr-export/qr-export-dialog";
import { postDownload } from "@/lib/qr-export/post-download";

export type AdminMachineRow = {
  id: string;
  number: number;
  name: string;
  type: string;
  category: string;
  status: string;
  location: string | null;
  serialNumber: string | null;
};

type TenantOption = { id: string; name: string; machineCount: number };

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actief",
  MAINTENANCE_DUE: "Onderhoud nodig",
  IN_MAINTENANCE: "In onderhoud",
  OUT_OF_SERVICE: "Buiten gebruik",
};

const TYPE_LABELS: Record<string, string> = {
  CARDIO: "Cardio",
  KRACHT: "Kracht",
  VRIJE_GEWICHTEN: "Vrije gewichten",
  OVERIG: "Overig",
};

/**
 * Superadmin QR-export: tenant-kiezer + selecteerbare machinelijst met filters,
 * of "alle tenants" (gebundelde export zonder per-machine-selectie). Hergebruikt
 * de gedeelde `QrExportDialog` en het `/admin/qr-export`-endpoint.
 */
export function AdminQrExport({
  tenants,
  selectedTenantId,
  machines,
}: {
  tenants: TenantOption[];
  selectedTenantId: string;
  machines: AdminMachineRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  const isAll = selectedTenantId === "all";

  function chooseTenant(id: string) {
    setSelected(new Set());
    const params = new URLSearchParams();
    if (id) params.set("tenantId", id);
    router.push(`/admin/qr-export${params.toString() ? `?${params}` : ""}`);
  }

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const m of machines) if (m.location?.trim()) set.add(m.location.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [machines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machines.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      if (statusFilter && m.status !== statusFilter) return false;
      if (locationFilter && (m.location ?? "") !== locationFilter) return false;
      return true;
    });
  }, [machines, query, typeFilter, statusFilter, locationFilter]);

  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

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
      if (allSelected) filtered.forEach((m) => next.delete(m.id));
      else filtered.forEach((m) => next.add(m.id));
      return next;
    });
  }

  const toPreview = (m: AdminMachineRow): PreviewMachine => ({
    id: m.id,
    name: m.name,
    number: m.number,
    category: m.category,
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Tenant-kiezer */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface-1 p-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Sportschool</span>
          <Select
            value={selectedTenantId}
            onChange={(e) => chooseTenant(e.target.value)}
            className="w-64"
          >
            <option value="">— Kies een sportschool —</option>
            <option value="all">Alle sportscholen (gebundeld)</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.machineCount})
              </option>
            ))}
          </Select>
        </label>
        {isAll ? (
          <Button onClick={() => setAllOpen(true)} className="ml-auto">
            <QrCode className="size-4" />
            Alle QR-codes exporteren
          </Button>
        ) : null}
      </div>

      {!selectedTenantId ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-neutral-500">
          Kies een sportschool om de apparaten te selecteren, of exporteer alle sportscholen gebundeld.
        </p>
      ) : isAll ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-neutral-500">
          Bij &ldquo;alle sportscholen&rdquo; worden de QR-codes van élke sportschool gebundeld,
          gegroepeerd per tenant. Klik op <span className="font-medium">Alle QR-codes exporteren</span>.
        </p>
      ) : machines.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-neutral-500">
          Deze sportschool heeft nog geen apparaten.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek apparaat…"
              className="max-w-xs"
            />
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
              <option value="">Alle types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
              <option value="">Alle statussen</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
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
              <Button onClick={() => setExportOpen(true)}>
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
                      checked={allSelected}
                      onChange={toggleAll}
                      className="size-4 accent-[var(--tenant-accent)]"
                    />
                  </Th>
                  <Th>Apparaat</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Locatie</Th>
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
                      <span className="font-medium text-neutral-900">{m.name}</span>
                      <p className="text-xs text-neutral-400">
                        Nr. {m.number}
                        {m.serialNumber ? ` · SN ${m.serialNumber}` : ""}
                      </p>
                    </Td>
                    <Td className="text-neutral-500">{TYPE_LABELS[m.type] ?? m.type}</Td>
                    <Td className="text-neutral-500">{STATUS_LABELS[m.status] ?? m.status}</Td>
                    <Td className="text-neutral-500">{m.location ?? "—"}</Td>
                  </Tr>
                ))}
                {filtered.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="py-8 text-center text-neutral-500">
                      Geen apparaten gevonden voor deze filters.
                    </Td>
                  </Tr>
                ) : null}
              </Tbody>
            </Table>
          </TableWrap>

          <QrExportDialog
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            endpoint="/admin/qr-export/download"
            hiddenParams={{ tenantId: selectedTenantId }}
            selected={machines.filter((m) => selected.has(m.id)).map(toPreview)}
            filtered={filtered.map(toPreview)}
            all={machines.map(toPreview)}
          />
        </>
      )}

      {/* "Alle tenants" — gebundelde export zonder id-selectie. */}
      <AllTenantsDialog open={allOpen} onClose={() => setAllOpen(false)} />
    </div>
  );
}

/** Vereenvoudigde dialoog voor "alle sportscholen" (geen per-machine-selectie). */
function AllTenantsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<"pdf" | "zip-png" | "zip-svg">("pdf");

  function download() {
    setBusy(true);
    postDownload("/admin/qr-export/download", { tenantId: "all", format });
    setTimeout(() => {
      setBusy(false);
      onClose();
    }, 1500);
  }

  // Kleine inline dialoog via de gedeelde Modal zou ook kunnen; hier houden we
  // het simpel met een conditionele render.
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-surface-2 p-5 shadow-lg">
        <h2 className="font-display text-lg font-bold text-neutral-900">Alle sportscholen exporteren</h2>
        <p className="text-sm text-neutral-600">
          De QR-codes van álle sportscholen worden gebundeld, gegroepeerd per tenant.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["pdf", "zip-png", "zip-svg"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                format === f ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-1"
              }`}
            >
              {f === "pdf" ? "PDF" : f === "zip-png" ? "ZIP·PNG" : "ZIP·SVG"}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-surface-1"
          >
            Annuleren
          </button>
          <Button onClick={download} loading={busy}>
            <QrCode className="size-4" />
            Exporteren
          </Button>
        </div>
      </div>
    </div>
  );
}
