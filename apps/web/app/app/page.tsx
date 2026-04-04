import Link from "next/link";
import { Card } from "../../components/card";
import { PageContainer } from "../../components/page-container";
import { WalletSessionPanel } from "../../components/wallet-session-panel";

export default function AppConsolePage() {
  return (
    <PageContainer
      title="Operator Console"
      subtitle="Worker onboarding, client orders, disputes, and Hedera audit."
    >
      <WalletSessionPanel />

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <h2 className="text-base font-semibold">Worker</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/app/worker/onboarding" className="text-[var(--color-text)] underline">
              Onboarding
            </Link>
            <Link href="/app/worker/profile" className="text-[var(--color-text)] underline">
              Profile
            </Link>
            <Link href="/app/worker/tasks" className="text-[var(--color-text)] underline">
              Tasks
            </Link>
            <Link href="/app/worker/reviews" className="text-[var(--color-text)] underline">
              Reviews
            </Link>
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Client</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/workers" className="text-[var(--color-text)] underline">
              Browse and book
            </Link>
            <Link href="/app/client/orders" className="text-[var(--color-text)] underline">
              Orders
            </Link>
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Audit</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Open an order and use the audit link to inspect Hedera transaction evidence.
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}
