import { PageSkeleton } from "@/components/loading-skeleton";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <Card className="overflow-hidden p-0" style={{ height: "calc(100vh - 200px)" }}>
        <div className="grid grid-cols-1 md:grid-cols-[220px_300px_1fr] h-full">
          {/* Mobile mostra só a coluna do meio (lista) durante loading */}
          <div className="hidden md:block border-r border-border p-3 space-y-2">
            <Skeleton className="h-9 w-full" />
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
          </div>
          <div className="md:border-r md:border-border p-3 space-y-3">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-2.5 w-3/5" />
              </div>
            ))}
          </div>
          <div className="hidden md:block p-8 space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-full mt-6" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      </Card>
    </PageSkeleton>
  );
}
