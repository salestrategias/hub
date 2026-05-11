import { PageSkeleton } from "@/components/loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 max-w-md" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-10 w-10 mx-auto" />
              <Skeleton className="h-3 w-4/5 mx-auto" />
              <Skeleton className="h-2.5 w-2/5 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    </PageSkeleton>
  );
}
