"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { StatusPill } from "../../../../components/status-pill";
import { WalletSessionPanel } from "../../../../components/wallet-session-panel";
import { listOrders } from "../../../../lib/api-client";
import type { OrderSummary } from "../../../../lib/models";
import type { HaasSession } from "../../../../lib/session";

export default function WorkerTasksPage() {
  const [session, setSession] = useState<HaasSession | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const workerId = session?.workerId;
    if (!workerId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const payload = await listOrders({ workerId });
        if (!cancelled) {
          setOrders(payload.items);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Unable to load tasks");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [session?.workerId]);

  const visibleOrders = session?.workerId ? orders : [];

  return (
    <PageContainer title="Worker Tasks" subtitle="Track assigned work and submit proof artifacts.">
      <WalletSessionPanel onSessionChange={setSession} />

      {!session?.workerId ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            No worker linked to this wallet. Complete onboarding first.
          </p>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading tasks...</p>
        </Card>
      ) : null}

      {!loading && session?.workerId && visibleOrders.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">No tasks found for this worker.</p>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {visibleOrders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{order.title}</h2>
                <p className="text-xs text-[var(--color-muted)]">{order.objective}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Amount: {order.amount} {order.currency}
                </p>
              </div>
              <StatusPill status={order.status} />
            </div>
            <div className="mt-3">
              <Link
                href={`/app/worker/tasks/${order.id}`}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]"
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
