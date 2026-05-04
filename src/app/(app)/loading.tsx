import { PageSkeleton, KpiRowSkeleton, TableSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <KpiRowSkeleton count={5} />
      <TableSkeleton rows={6} cols={5} />
    </PageSkeleton>
  );
}
