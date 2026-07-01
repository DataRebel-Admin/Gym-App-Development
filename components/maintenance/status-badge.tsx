import type { MachineStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { MACHINE_STATUS_META, type MaintenanceLevel } from "@/lib/maintenance";

/**
 * Statusbadge voor een machine. Toont de (effectieve) status; voor een actieve
 * machine die een limiet nadert tonen we een aparte "Binnenkort"-chip.
 */
export function MachineStatusBadge({
  status,
  level,
  className,
}: {
  status: MachineStatus;
  level?: MaintenanceLevel;
  className?: string;
}) {
  if (status === "ACTIVE" && level === "soon") {
    return (
      <Badge tone="warning" className={className}>
        <span aria-hidden>🕒</span> Binnenkort
      </Badge>
    );
  }
  const meta = MACHINE_STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={className}>
      <span aria-hidden>{meta.icon}</span> {meta.label}
    </Badge>
  );
}
