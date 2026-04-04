"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { StatusPill } from "../../../../components/status-pill";
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
  "FAILED"
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
          status: statusFilter || undefined
        });
        if (!cancelled) {
          setOrders(payload.items);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Unable to load client orders");
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
  }, [session?.walletAddress, statusFilter]);

  return (
    <PageContainer
      title="Client Orders"
      subtitle="Create, fund, review, and settle direct-booking orders."
      action={
        <Link
          href="/app/client/orders/new"
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)]"
        >
          Create Order
        </Link>
      }
    >
      <WalletSessionPanel required />

      <Card className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-[var(--color-muted)]">Client wallet</p>
          <p className="mt-1 text-sm text-[var(--color-text)]">
            {session?.walletAddress ?? "Not connected"}
          </p>
          {session?.walletAddress ? (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Namespace: {deriveClientNamespace(session.walletAddress)}
            </p>
          ) : null}
        </div>
        <div>
          <label className="text-xs font-semibold text-[var(--color-muted)]">Status filter</label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {ORDER_STATUS_OPTIONS.map((status) => (
              <option key={status || "all"} value={status}>
                {status || "All statuses"}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {error ? (
        <Card>
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading orders...</p>
        </Card>
      ) : null}

      {!loading && session?.walletAddress && visibleOrders.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            No orders found for this client wallet.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {visibleOrders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text)]">{order.title}</h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{order.objective}</p>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Worker: {order.workerId} · Amount: {order.amount} {order.currency}
                </p>
              </div>
              <StatusPill status={order.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/app/client/orders/${order.id}`}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
              >
                Open Order
              </Link>
              {order.status === "PAYMENT_PENDING" ? (
                <Link
                  href={`/app/client/orders/${order.id}/pay`}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
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
