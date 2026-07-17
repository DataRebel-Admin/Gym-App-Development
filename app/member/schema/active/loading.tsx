import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton voor de actieve sessie — de zwaarste member-route (requireMember +
 * timeout-check + buildActiveSessionView). Ontbrak eerder, waardoor "Start
 * training" een leeg gat toonde tot de render klaar was.
 */
export default function ActiveSessionLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="size-9 rounded-lg" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
