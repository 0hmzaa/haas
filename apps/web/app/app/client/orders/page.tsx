"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "../../../../components/button";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { StatusPill } from "../../../../components/status-pill";
import { SkeletonCard } from "../../../../components/skeleton";
import { WalletSessionPanel } from "../../../../components/wallet-session-panel";
import { listOrders } from "../../../../lib/api-client";
import type { OrderSummary } from "../../../../lib/models";
import { useSession } from "../../../../lib/session-context";
import { deriveClientNamespace } from "../../../../lib/session";

const ORDER_STATUS_OPTIONS = [
  "",
  "PAYMENT_PENDING",
  "FUNDED",
  "IN_PROGRESS",
  "REVIEW_WINDOW",
  "DISPUTED",
  "APPROVED",
  "AUTO_RELEASED",
  "REFUNDED",
  "SPLIT_SETTLED",
  "FAILED",
] as const;

export default function ClientOrdersPage() {
  const { session } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleOrders = session?.walletAddress ? orders : [];

  useEffect(() => {
    if (!session?.walletAddress) {
      setOrders([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await listOrders({
          clientAccountId: session.walletAddress,
          status: statusFilter || undefined,
        });
        if (!cancelled) setOrders(payload.items);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load client orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [session?.walletAddress, statusFilter]);

  return (
    <PageContainer
      title="Client Orders"
      subtitle="Create, fund, review, and settle direct-booking orders."
      action={
        <Link href="/app/client/orders/new">
          <Button size="sm">Create Order</Button>
        </Link>
      }
    >
      {!session?.walletAddress ? <WalletSessionPanel required /> : null}

      {session?.walletAddress ? (
        <Card variant="flat">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-[var(--color-muted)]">Client wallet</p>
              <p className="mt-1 font-mono text-sm font-bold">{session.walletAddress}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Namespace: {deriveClientNamespace(session.walletAddress)}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-muted)]">Status filter</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 w-full">
                {ORDER_STATUS_OPTIONS.map((status) => (
                  <option key={status || "all"} value={status}>
                    {status ? status.replace(/_/g, " ") : "All statuses"}
                  </option>
                ))}
              </select>
            </div>
          </div>
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

      {!loading && session?.walletAddress && visibleOrders.length === 0 ? (
        <Card variant="flat">
          <div className="py-6 text-center">
            <p className="text-sm font-bold text-[var(--color-muted)]">No orders found</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Create your first order to get started.</p>
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
                  Worker: <span className="font-mono font-bold text-[var(--color-text)]">{order.workerId}</span>
                  {" -- "}
                  Amount: <span className="font-bold text-[var(--color-text)]">{order.amount} {order.currency}</span>
                </p>
              </div>
              <StatusPill status={order.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/app/client/orders/${order.id}`}
                className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Open Order
              </Link>
              {order.status === "PAYMENT_PENDING" ? (
                <Link
                  href={`/app/client/orders/${order.id}/pay`}
                  className="border-2 border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0_var(--color-border-strong)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  Pay Now
                </Link>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
