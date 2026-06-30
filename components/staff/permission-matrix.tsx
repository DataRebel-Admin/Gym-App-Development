"use client";

import { useFormStatus } from "react-dom";
import { PERMISSION_GROUPS } from "@/lib/rbac";
import { buttonClasses } from "@/components/ui/button-classes";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClasses({ size: "sm" })}
    >
      {pending ? "Opslaan…" : "Rechten opslaan"}
    </button>
  );
}

/**
 * Overzichtelijke rechtenmatrix per medewerker. De aangevinkte permissies bepalen
 * wat AAN staat; opslaan stuurt de volledige set naar `setStaffPermissions`.
 */
export function PermissionMatrix({
  userId,
  enabled,
  action,
}: {
  userId: string;
  /** Permissie-keys die momenteel AAN staan voor deze medewerker. */
  enabled: string[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const on = new Set(enabled);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-4 sm:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <fieldset
            key={group.key}
            className="rounded-xl border border-border bg-surface-1 p-4"
          >
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {group.label}
            </legend>
            <div className="mt-2 flex flex-col gap-3">
              {group.permissions.map((p) => (
                <label key={p.permission} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={p.permission}
                    defaultChecked={on.has(p.permission)}
                    className="mt-0.5 size-4 accent-[var(--tenant-accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-900">
                      {p.label}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {p.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}
