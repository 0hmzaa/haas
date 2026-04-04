"use client";

import Link from "next/link";
import { Card } from "../../components/card";
import { PageContainer } from "../../components/page-container";
import { WalletSessionPanel } from "../../components/wallet-session-panel";
import { useSession } from "../../lib/session-context";

export default function AppWorkspacePage() {
  const { session } = useSession();

  return (
    <PageContainer
      title="Workspace"
      subtitle="Worker onboarding, mission execution, client orders, and dispute review."
    >
      <WalletSessionPanel />

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Worker Space</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Connect wallet, complete onboarding, execute tasks, and join dispute reviews.
          </p>
          {session?.walletAddress ? (
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/app/worker/onboarding" className="underline">
                Onboarding
              </Link>
              <Link href="/app/worker/profile" className="underline">
                Profile
              </Link>
              <Link href="/app/worker/tasks" className="underline">
                Tasks
              </Link>
              <Link href="/app/worker/reviews" className="underline">
                Reviews
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--color-warning)]">
              Connect HashPack to unlock worker pages.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Client Space</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Browse workers, create orders, fund via x402, and settle with approve/dispute flows.
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/workers" className="underline">
              Browse workers
            </Link>
            {session?.walletAddress ? (
              <Link href="/app/client/orders" className="underline">
                My orders
              </Link>
            ) : (
              <p className="text-xs text-[var(--color-warning)]">
                Connect HashPack to open client order pages.
              </p>
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
