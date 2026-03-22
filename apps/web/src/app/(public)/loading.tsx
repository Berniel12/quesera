import { Skeleton } from "@/components/ui/skeleton";

const DELAYS = ["", "delay-75", "delay-150", "delay-225", "delay-300", "delay-375"];

export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Hero skeleton */}
      <div className="mb-8">
        <Skeleton className="h-3 w-24 mb-3 rounded-full" />
        <Skeleton className="h-9 w-64 mb-2 rounded-lg" />
      </div>

      {/* Hero card skeleton */}
      <div className="rounded-3xl border border-border/40 p-6 sm:p-8 mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
        <Skeleton className="h-8 w-3/4 mb-2 rounded-lg" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
      </div>

      {/* Chip section skeleton */}
      <div className="mb-8">
        <Skeleton className="h-3 w-20 mb-3 rounded-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={`h-10 rounded-2xl ${i < 3 ? "w-48" : "w-40"} ${DELAYS[i]}`} />
          ))}
        </div>
      </div>

      {/* Card grid skeleton */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`rounded-2xl border border-border/40 p-4 ${DELAYS[i]}`}>
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-10 rounded-md" />
            </div>
            <Skeleton className="h-4 w-3/4 mb-2 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-2/3 mt-1 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
