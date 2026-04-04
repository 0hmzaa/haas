import Link from "next/link";

export function TopNav() {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-[var(--color-text)]">
          HumanAsAService
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-[var(--color-muted)]">
          <Link href="/workers" className="hover:text-[var(--color-text)]">
            Workers
          </Link>
          <Link href="/app" className="hover:text-[var(--color-text)]">
            Console
          </Link>
          <Link href="/spec" className="hover:text-[var(--color-text)]">
            Spec
          </Link>
        </nav>
      </div>
    </header>
  );
}
