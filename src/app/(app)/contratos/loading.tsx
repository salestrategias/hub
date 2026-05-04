import { PageSkeleton, TableSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <TableSkeleton rows={5} cols={6} />
    </PageSkeleton>
  );
}
