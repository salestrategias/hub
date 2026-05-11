import { PageSkeleton } from "@/components/loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex justify-between gap-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-7 gap-3 min-w-[1300px] overflow-x-auto pb-4">
        {Array.from({ length: 7 }).map((_, col) => (
          <div key={col} className="rounded-lg border border-border bg-card/40 p-2 min-h-[400px] space-y-2">
            <div className="flex items-center justify-between px-2 py-1.5 mb-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-6" />
            </div>
            {Array.from({ length: 2 + (col % 3) }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}
