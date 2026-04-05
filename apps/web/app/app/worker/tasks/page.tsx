"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { StatusPill } from "../../../../components/status-pill";
import { SkeletonCard } from "../../../../components/skeleton";
import { WalletSessionPanel } from "../../../../components/wallet-session-panel";
import { listOrders } from "../../../../lib/api-client";
import type { OrderSummary } from "../../../../lib/models";
import { useSession } from "../../../../lib/session-context";

export default function WorkerTasksPage() {
  const { session } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const workerId = session?.workerId;
    if (!workerId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await listOrders({ workerId });
        if (!cancelled) setOrders(payload.items);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load tasks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [session?.workerId]);

  const visibleOrders = orders;

  if (!session?.walletAddress) {
    return (
      <PageContainer title="Worker Tasks" subtitle="Track assigned work and submit proof artifacts.">
        <WalletSessionPanel required />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Worker Tasks" subtitle="Track assigned work and submit proof artifacts.">
      {!session?.workerId ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-muted)]">
            No worker linked to this wallet. Complete onboarding first.
          </p>
        </Card>
      ) : null}

      {error ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!loading && session?.workerId && visibleOrders.length === 0 ? (
        <Card variant="flat">
          <div className="py-6 text-center">
            <p className="text-sm font-bold text-[var(--color-muted)]">No tasks found</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">When a client books you, tasks will appear here.</p>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {visibleOrders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">{order.title}</h2>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">{order.objective}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Amount: <span className="font-bold text-[var(--color-text)]">{order.amount} {order.currency}</span>
                </p>
              </div>
              <StatusPill status={order.status} />
            </div>
            <div className="mt-3">
              <Link
                href={`/app/worker/tasks/${order.id}`}
                className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Open Task
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
