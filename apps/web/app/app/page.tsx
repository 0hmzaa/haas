"use client";

import Link from "next/link";
import { Card } from "../../components/card";
import { PageContainer } from "../../components/page-container";
import { WalletSessionPanel } from "../../components/wallet-session-panel";
import { useSession } from "../../lib/session-context";

const WORKER_LINKS = [
  { href: "/app/worker/onboarding", label: "Onboarding", desc: "Connect wallet and create profile" },
  { href: "/app/worker/profile", label: "Profile", desc: "Manage your worker profile" },
  { href: "/app/worker/tasks", label: "Tasks", desc: "View and execute assigned tasks" },
  { href: "/app/worker/reviews", label: "Reviews", desc: "Vote on assigned dispute cases" },
];

const CLIENT_LINKS = [
  { href: "/workers", label: "Browse Workers", desc: "Search verified workers by skill" },
  { href: "/app/client/orders", label: "My Orders", desc: "Track orders and settlements" },
  { href: "/app/client/orders/new", label: "New Order", desc: "Book a worker for a task" },
];

export default function AppWorkspacePage() {
  const { session } = useSession();

  return (
    <PageContainer
      title="Workspace"
      subtitle="Worker onboarding, mission execution, client orders, and dispute review."
    >
      {!session?.walletAddress ? <WalletSessionPanel required /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-base font-bold">Worker Space</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Connect wallet, complete onboarding, execute tasks, and join dispute reviews.
          </p>

          {session?.walletAddress ? (
            <div className="mt-4 grid gap-2">
              {WORKER_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between border-2 border-[var(--color-border)] p-3 text-sm transition-all hover:border-[var(--color-border-strong)] hover:shadow-[2px_2px_0_var(--color-border-strong)]"
                >
                  <div>
                    <span className="font-bold">{link.label}</span>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">{link.desc}</p>
                  </div>
                  <span className="text-[var(--color-muted)]">&rarr;</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold text-[var(--color-warning)]">
              Connect HashPack to unlock worker pages.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-base font-bold">Client Space</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Browse workers, create orders, fund via x402, and settle with approve/dispute flows.
          </p>

          <div className="mt-4 grid gap-2">
            {CLIENT_LINKS.map((link) => {
              const needsWallet = link.href.startsWith("/app/client");
              if (needsWallet && !session?.walletAddress) return null;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between border-2 border-[var(--color-border)] p-3 text-sm transition-all hover:border-[var(--color-border-strong)] hover:shadow-[2px_2px_0_var(--color-border-strong)]"
                >
                  <div>
                    <span className="font-bold">{link.label}</span>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">{link.desc}</p>
                  </div>
                  <span className="text-[var(--color-muted)]">&rarr;</span>
                </Link>
              );
            })}
            {!session?.walletAddress ? (
              <p className="text-xs font-semibold text-[var(--color-warning)]">
                Connect HashPack to open client order pages.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
