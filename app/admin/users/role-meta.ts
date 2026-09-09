import type { BadgeTone } from "@/components/ui/badge";

/** Rol-labels en badge-tinten voor het superadmin-gebruikersbeheer. */
export const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  TENANT_ADMIN: "Tenant-admin",
  TENANT_STAFF: "Medewerker",
  TENANT_MEMBER: "Lid",
};

export const ROLE_TONE: Record<string, BadgeTone> = {
  SUPERADMIN: "danger",
  TENANT_ADMIN: "accent",
  TENANT_STAFF: "info",
  TENANT_MEMBER: "neutral",
};

/** Rollen die een superadmin op een tenant-gebruiker mag zetten. */
export const TENANT_ROLES = ["TENANT_ADMIN", "TENANT_STAFF", "TENANT_MEMBER"] as const;
