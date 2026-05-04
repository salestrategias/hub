import { PageSkeleton, KanbanSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <KanbanSkeleton cols={5} />
    </PageSkeleton>
  );
}
