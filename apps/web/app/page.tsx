import Link from "next/link";
import { Card } from "../components/card";
import { PageContainer } from "../components/page-container";

export default function HomePage() {
  return (
    <PageContainer
      title="Verified Human Execution Layer"
      subtitle="Book one verified human for one task, lock payment, receive proof, settle on Hedera."
      action={
        <div className="flex gap-2">
          <Link
            href="/workers"
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)]"
          >
            Browse Workers
          </Link>
          <Link
            href="/app"
            className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]"
          >
            Open Console
          </Link>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-base font-semibold">1. Discover</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Find available workers by location, skill, price, and reputation.
          </p>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">2. Execute</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Fund order through x402-compatible flow, worker executes, proof is submitted.
          </p>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">3. Settle</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Approve, dispute, or auto-release after timeout with auditable Hedera events.
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Why this architecture</h2>
        <ul className="mt-3 grid gap-2 text-sm text-[var(--color-muted)] md:grid-cols-2">
          <li>World ID for proof-of-human and identity continuity.</li>
          <li>x402 as agent-facing payment interface.</li>
          <li>Hedera account transfers for settlement without Solidity.</li>
          <li>HCS as compact lifecycle audit timeline.</li>
        </ul>
      </Card>
    </PageContainer>
  );
}
