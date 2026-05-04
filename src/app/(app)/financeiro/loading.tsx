import { PageSkeleton, KpiRowSkeleton, TableSkeleton } from "@/components/loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <KpiRowSkeleton count={4} />
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-4 w-48 mb-4" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
      <TableSkeleton rows={6} cols={6} />
    </PageSkeleton>
  );
}
