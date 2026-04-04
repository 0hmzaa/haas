"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NavWalletButton } from "./nav-wallet-button";

const NAV_LINKS = [
  { href: "/workers", label: "Workers" },
  { href: "/docs", label: "Docs" },
  { href: "/app", label: "Workspace" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b-2 border-[var(--color-border-strong)] bg-[var(--color-surface)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="font-mono text-lg font-bold tracking-tight text-[var(--color-text)]"
        >
          HaaS<span className="text-[var(--color-muted)]">.</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold transition ${
                  active
                    ? "text-[var(--color-text)] underline underline-offset-4 decoration-2"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <NavWalletButton />
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden border-2 border-[var(--color-border-strong)] p-2 text-xs font-bold"
          aria-label="Toggle menu"
        >
          {menuOpen ? "X" : "="}
        </button>
      </div>

      {menuOpen ? (
        <div className="border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`text-sm font-semibold ${
                    active
                      ? "text-[var(--color-text)] underline underline-offset-4 decoration-2"
                      : "text-[var(--color-muted)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4">
            <NavWalletButton />
          </div>
        </div>
      ) : null}
    </header>
  );
}
