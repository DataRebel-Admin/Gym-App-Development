import { Skeleton } from "@/components/ui/skeleton";

export default function TrophiesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-7">
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="h-24 rounded-3xl" />
      <Skeleton className="h-16 rounded-2xl" />
      <div className="grid grid-cols-1 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
