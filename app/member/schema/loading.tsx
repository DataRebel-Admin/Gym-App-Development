import { Skeleton } from "@/components/ui/skeleton";

export default function MemberSchemaLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-1 p-4">
        <Skeleton className="size-[88px] rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-2xl" />
    </div>
  );
}
