import type { PendingInvitationRow } from "@/lib/invitation";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  TableWrap,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
} from "@/components/ui/table";

const ROLE_LABEL: Record<string, string> = {
  TENANT_ADMIN: "Beheerder",
  TENANT_MEMBER: "Lid",
};

const STATUS_TONE: Record<PendingInvitationRow["status"], BadgeTone> = {
  VERZONDEN: "accent",
  VERLOPEN: "danger",
};

const STATUS_LABEL: Record<PendingInvitationRow["status"], string> = {
  VERZONDEN: "Verzonden",
  VERLOPEN: "Verlopen",
};

const rowBtn =
  "rounded-lg border border-border-strong px-2 py-1 text-xs hover:bg-neutral-50";

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Gedeeld overzicht van uitstaande uitnodigingen — gebruikt door superadmin
 * (platformbreed, `showTenant`) én tenant-admin (gescoped). De resend/revoke
 * server-actions worden door de caller meegegeven zodat scoping + revalidatie
 * op de juiste plek gebeurt.
 */
export function PendingInvitationsTable({
  rows,
  showTenant = false,
  resendAction,
  revokeAction,
}: {
  rows: PendingInvitationRow[];
  showTenant?: boolean;
  resendAction: (formData: FormData) => void | Promise<void>;
  revokeAction: (formData: FormData) => void | Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface-1 px-4 py-6 text-center text-sm text-neutral-500">
        Geen uitstaande uitnodigingen.
      </p>
    );
  }

  return (
    <TableWrap>
      <Table>
        <Thead>
          <tr>
            <Th>E-mail</Th>
            {showTenant ? <Th>Tenant</Th> : null}
            <Th>Rol</Th>
            <Th>Status</Th>
            <Th>Verloopt</Th>
            <Th className="text-right">Acties</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((inv) => (
            <Tr key={inv.id}>
              <Td>
                <p className="font-medium text-neutral-900">{inv.email}</p>
                {inv.invitedByName || inv.invitedByEmail ? (
                  <p className="text-xs text-neutral-500">
                    door {inv.invitedByName ?? inv.invitedByEmail}
                  </p>
                ) : null}
              </Td>
              {showTenant ? <Td className="text-neutral-600">{inv.tenantName}</Td> : null}
              <Td>
                <Badge tone={inv.role === "TENANT_ADMIN" ? "accent" : "neutral"}>
                  {ROLE_LABEL[inv.role] ?? inv.role}
                </Badge>
              </Td>
              <Td>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                  {inv.hasAccount ? <Badge tone="neutral">heeft account</Badge> : null}
                </div>
              </Td>
              <Td className="text-neutral-600">{formatDate(inv.expiresAt)}</Td>
              <Td>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <form action={resendAction}>
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <button type="submit" className={rowBtn}>
                      Opnieuw sturen
                    </button>
                  </form>
                  <ConfirmButton
                    action={revokeAction}
                    fields={{ invitationId: inv.id }}
                    label="Intrekken"
                    triggerClassName="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    title="Uitnodiging intrekken?"
                    message={`De uitnodiging voor ${inv.email} wordt verwijderd. De bestaande link werkt daarna niet meer.`}
                    confirmLabel="Intrekken"
                  />
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableWrap>
  );
}
