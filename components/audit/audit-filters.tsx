"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_META,
  auditActionOptions,
  type AuditCategory,
} from "@/lib/audit-actions";

const CATEGORIES = Object.keys(CATEGORY_META) as AuditCategory[];

export function AuditFilters({
  actors,
  tenants,
}: {
  actors: string[];
  tenants?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [search, setSearch] = useState(sp.get("search") ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");
  const [action, setAction] = useState(sp.get("action") ?? "");
  const [actor, setActor] = useState(sp.get("actor") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [tenant, setTenant] = useState(sp.get("tenant") ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  const actionOptions = auditActionOptions().filter(
    (o) => !category || o.category === category
  );

  function apply() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (action) params.set("action", action);
    if (actor) params.set("actor", actor);
    if (status) params.set("status", status);
    if (tenant) params.set("tenant", tenant);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`${pathname}?${params.toString()}`);
  }

  function reset() {
    setSearch(""); setCategory(""); setAction(""); setActor("");
    setStatus(""); setTenant(""); setFrom(""); setTo("");
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
            placeholder="actie, e-mail of object-id…"
          />
        </Field>
        <Field label="Categorie">
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setAction("");
            }}
          >
            <option value="">Alle</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Actie">
          <Select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Alle</option>
            {actionOptions.map((o) => (
              <option key={o.action} value={o.action}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Gebruiker">
          <Select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Alle</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        {tenants ? (
          <Field label="Tenant">
            <Select value={tenant} onChange={(e) => setTenant(e.target.value)}>
              <option value="">Alle</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Alle</option>
            <option value="SUCCESS">Succes</option>
            <option value="FAILED">Mislukt</option>
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
