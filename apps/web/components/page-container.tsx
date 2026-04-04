import type { ReactNode } from "react";

type PageContainerProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function PageContainer({ title, subtitle, action, children }: PageContainerProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </section>
      {children}
    </main>
  );
}
