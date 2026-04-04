"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { StatusPill } from "../../../../components/status-pill";
import { WalletSessionPanel } from "../../../../components/wallet-session-panel";
import { getReviewerReputation, listOrders } from "../../../../lib/api-client";
import type { OrderSummary, ReputationReviewerResponse } from "../../../../lib/models";
import type { HaasSession } from "../../../../lib/session";

export default function WorkerReviewsPage() {
  const [session, setSession] = useState<HaasSession | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [reputation, setReputation] = useState<ReputationReviewerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleOrders = session?.verifiedHumanId ? orders : [];

  useEffect(() => {
    const reviewerId = session?.verifiedHumanId;
    if (!reviewerId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ordersPayload, reputationPayload] = await Promise.all([
          listOrders({ reviewerId }),
          getReviewerReputation(reviewerId).catch(() => null)
        ]);
        if (!cancelled) {
          setOrders(ordersPayload.items);
          setReputation(reputationPayload);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Unable to load review queue");
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
  }, [session?.verifiedHumanId]);

  return (
    <PageContainer
      title="Review Queue"
      subtitle="Dispute cases assigned to you as reviewer."
    >
      <WalletSessionPanel onSessionChange={setSession} required />

      {!session?.verifiedHumanId ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            Reviewer identity is not linked yet. Complete World verification in onboarding flow.
          </p>
        </Card>
      ) : null}

      {session?.verifiedHumanId && reputation ? (
        <Card>
          <h2 className="text-base font-semibold">Reviewer Reputation</h2>
          <div className="mt-3 grid gap-2 text-sm text-[var(--color-muted)] md:grid-cols-2">
            <p>
              Trust score: <span className="font-semibold text-[var(--color-text)]">{reputation.trustScore.toFixed(2)}</span>
            </p>
            <p>
              Reviews completed: <span className="font-semibold text-[var(--color-text)]">{reputation.reviewsCompleted}</span>
            </p>
            <p>
              Majority alignment: <span className="font-semibold text-[var(--color-text)]">{(reputation.majorityAlignmentRate * 100).toFixed(0)}%</span>
            </p>
            <p>
              Review speed score: <span className="font-semibold text-[var(--color-text)]">{reputation.reviewSpeedScore.toFixed(2)}</span>
            </p>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading assigned disputes...</p>
        </Card>
      ) : null}

      {!loading && session?.verifiedHumanId && visibleOrders.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">No disputes assigned right now.</p>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {visibleOrders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{order.title}</h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">Order ID: {order.id}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Amount: {order.amount} {order.currency}
                </p>
              </div>
              <StatusPill status={order.status} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/app/worker/reviews/${order.id}`}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
              >
                Open Review
              </Link>
              <Link
                href={`/app/orders/${order.id}/audit`}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
              >
                Open Audit
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
