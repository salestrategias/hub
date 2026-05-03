import { Header } from "@/components/header";

export async function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header title={title} subtitle={subtitle} />
      <div className="px-8 py-7 space-y-6 animate-slide-up">
        {actions && <div className="flex justify-end">{actions}</div>}
        {children}
      </div>
    </>
  );
}
