import { PageSkeleton, TableSkeleton } from "@/components/loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <Card>
        <CardContent className="p-4 space-y-4">
          <Skeleton className="h-9 w-full max-w-md" />
          <div className="border-t border-border pt-4 space-y-3">
            <Skeleton className="h-3 w-12" />
            <div className="flex gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-20 rounded-full" />)}
            </div>
            <Skeleton className="h-3 w-12" />
            <div className="flex gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-24 rounded-full" />)}
            </div>
          </div>
        </CardContent>
      </Card>
      <TableSkeleton rows={7} cols={6} />
    </PageSkeleton>
  );
}
