"use client";

import { useRouter } from "next/navigation";

type Option = { id: string; name: string; slug: string };

/** Navigeert bij keuze naar /admin/features?tenant=<id> (server re-render). */
export function FeatureTenantPicker({
  tenants,
  current,
}: {
  tenants: Option[];
  current: string;
}) {
  const router = useRouter();
  return (
    <label className="flex flex-col gap-1.5 sm:max-w-xs">
      <span className="text-xs font-medium text-neutral-500">Sportschool</span>
      <select
        value={current}
        onChange={(e) => router.push(`/admin/features?tenant=${e.target.value}`)}
        className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-neutral-900 focus:border-accent focus:outline-none"
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.slug})
          </option>
        ))}
      </select>
    </label>
  );
}
