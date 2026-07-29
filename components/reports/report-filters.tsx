"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  REPORT_TYPE_META,
  REPORT_STATUS_META,
  REPORT_SEVERITY_META,
} from "@/components/reports/report-meta";

// Filterbalk voor /admin/meldingen — kloon van components/audit/audit-filters.tsx:
// lokale state geseed uit de URL; "Filter toepassen" pusht de query (filters in
// de URL, deelbaar), "Wissen" reset naar het kale pad.
export function ReportFilters({
  tenants,
  platforms,
  versions,
}: {
  tenants: { id: string; name: string }[];
  platforms: string[];
  versions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [search, setSearch] = useState(sp.get("search") ?? "");
  const [herkomst, setHerkomst] = useState(sp.get("herkomst") ?? "");
  const [type, setType] = useState(sp.get("type") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [severity, setSeverity] = useState(sp.get("severity") ?? "");
  const [platform, setPlatform] = useState(sp.get("platform") ?? "");
  const [version, setVersion] = useState(sp.get("version") ?? "");
  const [tenant, setTenant] = useState(sp.get("tenant") ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function apply() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (herkomst) params.set("herkomst", herkomst);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    if (platform) params.set("platform", platform);
    if (version) params.set("version", version);
    if (tenant) params.set("tenant", tenant);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`${pathname}?${params.toString()}`);
  }

  function reset() {
    setSearch(""); setHerkomst(""); setType(""); setStatus("");
    setSeverity(""); setPlatform(""); setVersion(""); setTenant("");
    setFrom(""); setTo("");
    router.push(pathname);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Zoeken" className="lg:col-span-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="titel, omschrijving, route of id…"
          />
        </Field>
        <Field label="Herkomst">
          <Select value={herkomst} onChange={(e) => setHerkomst(e.target.value)}>
            <option value="">Alle</option>
            <option value="lid">Lid</option>
            <option value="sportschool">Sportschool</option>
          </Select>
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Alle</option>
            {Object.entries(REPORT_TYPE_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Alle</option>
            {Object.entries(REPORT_STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prioriteit">
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">Alle</option>
            {Object.entries(REPORT_SEVERITY_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Platform">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">Alle</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="App-versie">
          <Select value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="">Alle</option>
            {versions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sportschool">
          <Select value={tenant} onChange={(e) => setTenant(e.target.value)}>
            <option value="">Alle</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Van">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Tot">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={apply}>
          Filter toepassen
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          Wissen
        </Button>
      </div>
    </div>
  );
}
