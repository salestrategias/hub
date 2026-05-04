import { PageSkeleton } from "@/components/loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-[600px] w-full" />
        </CardContent>
      </Card>
    </PageSkeleton>
  );
}
