import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton voor de member-home — matcht de echte layout zodat de overgang rustig is. */
export default function MemberHomeLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-7">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-surface-1 p-5">
        <Skeleton className="size-[104px] rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-44 rounded-3xl" />
      <Skeleton className="h-14 rounded-2xl" />
    </div>
  );
}
