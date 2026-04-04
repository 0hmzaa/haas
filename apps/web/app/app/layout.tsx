"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSession } from "../../lib/session-context";

const WORKER_LINKS = [
  { href: "/app/worker/onboarding", label: "Onboarding" },
  { href: "/app/worker/profile", label: "Profile" },
  { href: "/app/worker/tasks", label: "Tasks" },
  { href: "/app/worker/reviews", label: "Reviews" },
] as const;

const CLIENT_LINKS = [
  { href: "/app/client/orders", label: "Orders" },
  { href: "/app/client/orders/new", label: "New Order" },
] as const;

function SidebarLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-[var(--color-primary)] text-[var(--color-primary-contrast)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const sidebarContent = (
    <>
      <div className="px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Worker
        </p>
      </div>
      {WORKER_LINKS.map((link) => (
        <SidebarLink
          key={link.href}
          href={link.href}
          label={link.label}
          active={isActive(link.href)}
          onClick={() => setDrawerOpen(false)}
        />
      ))}

      <div className="my-2 border-t-2 border-[var(--color-border)]" />

      <div className="px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Client
        </p>
      </div>
      {CLIENT_LINKS.map((link) => (
        <SidebarLink
          key={link.href}
          href={link.href}
          label={link.label}
          active={isActive(link.href)}
          onClick={() => setDrawerOpen(false)}
        />
      ))}

      {session?.walletAddress ? (
        <>
          <div className="my-2 border-t-2 border-[var(--color-border)]" />
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">
              Session
            </p>
            <p className="mt-1 truncate font-mono text-xs text-[var(--color-text)]">
              {session.walletAddress}
            </p>
            {session.workerId ? (
              <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                Worker: {session.workerId}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-1">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] py-4 md:block">
        {sidebarContent}
      </aside>

      {/* Mobile drawer toggle */}
      <div className="sticky top-0 z-30 flex items-center border-b-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="border-2 border-[var(--color-border-strong)] px-2 py-1 text-xs font-bold"
        >
          {drawerOpen ? "X" : "NAV"}
        </button>
        <span className="ml-3 text-xs font-semibold text-[var(--color-muted)]">
          {pathname.split("/").pop()}
        </span>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-50 h-full w-60 border-r-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] py-4 md:hidden">
            {sidebarContent}
          </aside>
        </>
      ) : null}

      {/* Main content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
