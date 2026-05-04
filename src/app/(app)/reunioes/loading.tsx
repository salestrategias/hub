import { PageSkeleton, KpiRowSkeleton, TableSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <KpiRowSkeleton count={4} />
      <TableSkeleton rows={6} cols={6} />
    </PageSkeleton>
  );
}
