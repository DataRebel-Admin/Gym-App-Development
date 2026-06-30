/** Geserialiseerde auditlog-regel die van server → client wordt doorgegeven. */
export type AuditRowData = {
  id: string;
  createdAt: string; // ISO
  action: string;
  category: string | null;
  status: "SUCCESS" | "FAILED";
  actorEmail: string | null;
  actorRole: string | null;
  tenantId: string | null;
  tenantName: string | null;
  targetType: string | null;
  targetId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
};
