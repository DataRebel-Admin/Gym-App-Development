"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { machineTypeLabel } from "@/lib/machine";

export type MachineRow = {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
  hasQr: boolean;
};

type SortKey = "name" | "type";

export function MachinesTable({ machines }: { machines: MachineRow[] }) {
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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op naam…"
          className="w-full max-w-xs rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="name">Sorteer op naam</option>
          <option value="type">Sorteer op type</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Foto</th>
              <th className="px-4 py-2 font-medium">Naam</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">QR</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">
                  {m.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imageUrl}
                      alt={m.name}
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-neutral-100" />
                  )}
                </td>
                <td className="px-4 py-2 font-medium text-neutral-900">
                  {m.name}
                </td>
                <td className="px-4 py-2 text-neutral-700">
                  {machineTypeLabel(m.type)}
                </td>
                <td className="px-4 py-2">
                  {m.hasQr ? (
                    <span className="text-neutral-700">✓</span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/owner/machines/${m.id}`}
                    className="text-accent hover:underline"
                  >
                    Bewerken
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  Geen machines gevonden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
