import { PageSkeleton, CardListSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <CardListSkeleton count={5} />
    </PageSkeleton>
  );
}
