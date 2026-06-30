function toRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "aan" : "uit";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Veld-voor-veld vergelijking van oude ↔ nieuwe waarde. Toont per gewijzigd
 * veld de oude (rood) en nieuwe (groen) waarde.
 */
export function AuditDiff({
  oldValue,
  newValue,
}: {
  oldValue: unknown;
  newValue: unknown;
}) {
  const oldRec = toRecord(oldValue);
  const newRec = toRecord(newValue);
  if (!oldRec && !newRec) return null;

  const keys = Array.from(
    new Set([...Object.keys(oldRec ?? {}), ...Object.keys(newRec ?? {})])
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Wijzigingen
      </p>
      <div className="overflow-hidden rounded-xl border border-border">
        {keys.map((key, i) => {
          const before = oldRec?.[key];
          const after = newRec?.[key];
          const changed = fmt(before) !== fmt(after);
          return (
            <div
              key={key}
              className={`grid grid-cols-[8rem_1fr] gap-2 px-3 py-2 text-sm ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="font-medium text-neutral-500">{key}</span>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    changed
                      ? "bg-red-50 text-red-700 line-through"
                      : "text-neutral-500"
                  }`}
                >
                  {fmt(before)}
                </span>
                {changed ? (
                  <>
                    <span className="text-neutral-400">→</span>
                    <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                      {fmt(after)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
