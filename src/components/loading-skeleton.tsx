/**
 * Skeletons padronizados para Suspense boundaries.
 *
 * Use loading.tsx por rota: `export default LoadingPage` etc.
 * Convenção: animação suave + cores `bg-muted/50`, mantendo proporção
 * aproximada do conteúdo real para não causar "salto" no layout.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeaderSkeleton() {
  return (
    <div className="px-8 py-3.5 border-b border-border">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-3 w-72 mt-2" />
    </div>
  );
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn("grid gap-3", count === 5 ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4")}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28 mt-3" />
            <Skeleton className="h-2.5 w-16 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-border px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 max-w-[120px]" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="border-b border-border last:border-0 px-4 py-3 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-3.5", c === 0 ? "flex-1 max-w-[200px]" : "flex-1 max-w-[100px]")}
                style={{ animationDelay: `${(r * cols + c) * 30}ms` }}
              />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-3 w-20 shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function KanbanSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="grid gap-3 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, minWidth: "1100px" }}>
      {Array.from({ length: cols }).map((_, c) => (
        <div key={c} className="card p-2 min-h-[420px]" style={{ background: "rgba(19,19,28,0.4)" }}>
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 2 + Math.floor(Math.random() * 2) }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                  <div className="flex justify-between">
                    <Skeleton className="h-2.5 w-12" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Wrapper com PageShell-like layout pra rotas que tem header + conteúdo. */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="px-8 py-7 space-y-6">{children}</div>
    </>
  );
}
