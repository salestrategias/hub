import { Header } from "@/components/header";

export async function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header title={title} subtitle={subtitle} />
      <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-7 space-y-5 sm:space-y-6 animate-slide-up">
        {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
        {children}
      </div>
    </>
  );
}
