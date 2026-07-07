"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
import { cn } from "@/lib/cn";
import type { TenantFlag, TenantHealthRow } from "@/lib/admin-dashboard";

const FLAG_META: Record<TenantFlag, { label: string; tone: BadgeTone }> = {
  inactive: { label: "Inactief", tone: "danger" },
  no_admin: { label: "Geen beheerder", tone: "danger" },
  stale: { label: "Stil", tone: "warning" },
  empty: { label: "Leeg", tone: "accent" },
};

/** Compacte relatieve tijd, NL. */
function relTime(iso: string | null): string {
  if (!iso) return "nooit";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < day) return "vandaag";
  const days = Math.floor(diff / day);
  if (days === 1) return "gisteren";
  if (days < 7) return `${days} d geleden`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} wk geleden`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mnd geleden`;
  return `${Math.floor(days / 365)} jr geleden`;
}

function FlagBadges({ flags }: { flags: TenantFlag[] }) {
  if (flags.length === 0) return <Badge tone="success">Gezond</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge key={f} tone={FLAG_META[f].tone}>
          {FLAG_META[f].label}
        </Badge>
      ))}
    </span>
  );
}

export function TenantHealthTable({ rows }: { rows: TenantHealthRow[] }) {
  const [query, setQuery] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyAttention && r.flags.length === 0) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)
      );
    });
  }, [rows, query, onlyAttention]);

  const attentionCount = rows.filter((r) => r.flags.length > 0).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek tenant…"
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface-0 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setOnlyAttention((v) => !v)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
            onlyAttention
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-neutral-700 hover:bg-neutral-50"
          )}
        >
          Vraagt aandacht
          <span
            className={cn(
              "rounded-full px-1.5 text-xs tabular-nums",
              onlyAttention ? "bg-accent text-accent-foreground" : "bg-neutral-100"
            )}
          >
            {attentionCount}
          </span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="Geen tenants"
          description={
            onlyAttention
              ? "Alle tenants zijn gezond. 🎉"
              : "Geen tenant komt overeen met je zoekopdracht."
          }
        />
      ) : (
        <>
          {/* Mobiel */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {filtered.map((t) => (
              <MobileListCard key={t.id} href={`/admin/tenants/${t.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: t.accentColor ?? "#d4d4d4" }}
                    />
                    <span className="truncate font-medium text-neutral-900">
                      {t.name}
                    </span>
                  </span>
                  <FlagBadges flags={t.flags} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {t.members} leden · {t.team} team
                  </span>
                  <span>
                    {t.sessions7}× 7d · {relTime(t.lastActivity)}
                  </span>
                </div>
              </MobileListCard>
            ))}
          </div>

          {/* Desktop */}
          <TableWrap className="hidden md:block">
            <Table>
              <Thead>
                <tr>
                  <Th>Tenant</Th>
                  <Th className="text-right">Leden</Th>
                  <Th className="text-right">Team</Th>
                  <Th className="text-right">Trainingen 7d</Th>
                  <Th>Laatste activiteit</Th>
                  <Th>Status</Th>
                  <Th className="text-right" />
                </tr>
              </Thead>
              <Tbody>
                {filtered.map((t) => (
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
                        <span className="font-medium text-neutral-900">
                          {t.name}
                        </span>
                        <span className="font-mono text-xs text-neutral-400">
                          {t.slug}
                        </span>
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums text-neutral-700">
                      {t.members}
                    </Td>
                    <Td className="text-right tabular-nums text-neutral-500">
                      {t.team}
                    </Td>
                    <Td
                      className={cn(
                        "text-right tabular-nums",
                        t.sessions7 > 0
                          ? "text-neutral-900"
                          : "text-neutral-400"
                      )}
                    >
                      {t.sessions7}
                    </Td>
                    <Td
                      className={cn(
                        "text-sm",
                        t.flags.includes("stale")
                          ? "text-amber-600"
                          : "text-neutral-500"
                      )}
                    >
                      {relTime(t.lastActivity)}
                    </Td>
                    <Td>
                      <FlagBadges flags={t.flags} />
                    </Td>
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
