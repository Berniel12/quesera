import { Skeleton } from "@/components/ui/skeleton";

export default function TopicLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Skeleton className="h-4 w-20 mb-2" />
      <Skeleton className="h-10 w-2/3 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-8" />

      <div className="rounded-3xl border border-border/40 p-8 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-full mb-2" />
        <Skeleton className="h-6 w-3/4" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-3xl border border-border/40 p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="rounded-3xl border border-border/40 p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
