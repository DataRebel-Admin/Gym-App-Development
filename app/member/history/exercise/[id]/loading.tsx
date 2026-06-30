import { Skeleton } from "@/components/ui/skeleton";

export default function ExerciseDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-6">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-64 rounded-3xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}
