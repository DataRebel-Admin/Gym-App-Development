import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton voor de account-hub (rendert in de content-kolom naast de zijnav). */
export default function AccountLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}
