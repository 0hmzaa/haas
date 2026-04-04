import type { ReactNode } from "react";

type PageContainerProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  wide?: boolean;
};

export function PageContainer({
  title,
  subtitle,
  action,
  children,
  wide = false,
}: PageContainerProps) {
  return (
    <main
      className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-8 ${wide ? "max-w-7xl" : "max-w-6xl"}`}
    >
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--color-text)]">
            {title}
          </h1>
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
