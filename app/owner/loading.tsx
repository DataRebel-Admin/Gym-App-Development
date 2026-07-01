import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generieke skeleton voor de owner-werkruimte. Dekt via de App Router-cascade
 * alle owner-subpagina's die zelf geen `loading.tsx` hebben, zodat navigatie
 * nooit een blanco scherm toont. Matcht het standaard paginacontainer-ritme
 * (`gap-6 px-4 py-6 sm:px-6 sm:py-8`) → rustige overgang naar de echte inhoud.
 */
export default function OwnerLoading() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="hidden h-10 w-36 rounded-lg sm:block" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
