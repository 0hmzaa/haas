"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { StatusPill } from "../../../../components/status-pill";
import { SkeletonCard } from "../../../../components/skeleton";
import { WalletSessionPanel } from "../../../../components/wallet-session-panel";
import { getReviewerReputation, listOrders } from "../../../../lib/api-client";
import type { OrderSummary, ReputationReviewerResponse } from "../../../../lib/models";
import { useSession } from "../../../../lib/session-context";

export default function WorkerReviewsPage() {
  const { session } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [reputation, setReputation] = useState<ReputationReviewerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleOrders = orders;

  useEffect(() => {
    const reviewerId = session?.verifiedHumanId;
    if (!reviewerId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ordersPayload, reputationPayload] = await Promise.all([
          listOrders({ reviewerId }),
          getReviewerReputation(reviewerId).catch(() => null),
        ]);
        if (!cancelled) {
          setOrders(ordersPayload.items);
          setReputation(reputationPayload);
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load review queue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [session?.verifiedHumanId]);

  if (!session?.walletAddress) {
    return (
      <PageContainer title="Review Queue" subtitle="Dispute cases assigned to you as reviewer.">
        <WalletSessionPanel required />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Review Queue" subtitle="Dispute cases assigned to you as reviewer.">
      {!session?.verifiedHumanId ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-muted)]">
            Reviewer identity is not linked yet. Complete World verification in onboarding flow.
          </p>
        </Card>
      ) : null}

      {error ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {session?.verifiedHumanId && reputation ? (
        <Card>
          <h2 className="text-base font-bold">Reviewer Reputation</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="border-2 border-[var(--color-border)] p-3 text-center">
              <p className="text-2xl font-black">{reputation.trustScore.toFixed(2)}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Trust Score</p>
            </div>
            <div className="border-2 border-[var(--color-border)] p-3 text-center">
              <p className="text-2xl font-black">{reputation.reviewsCompleted}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Reviews Done</p>
            </div>
            <div className="border-2 border-[var(--color-border)] p-3 text-center">
              <p className="text-2xl font-black">{(reputation.majorityAlignmentRate * 100).toFixed(0)}%</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Alignment</p>
            </div>
            <div className="border-2 border-[var(--color-border)] p-3 text-center">
              <p className="text-2xl font-black">{reputation.reviewSpeedScore.toFixed(2)}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Speed Score</p>
            </div>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!loading && session?.verifiedHumanId && visibleOrders.length === 0 ? (
        <Card variant="flat">
          <div className="py-6 text-center">
            <p className="text-sm font-bold text-[var(--color-muted)]">No disputes assigned</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">When a dispute is raised, eligible reviewers are assigned automatically.</p>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {visibleOrders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">{order.title}</h2>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">Order ID: <span className="font-mono">{order.id}</span></p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Amount: <span className="font-bold text-[var(--color-text)]">{order.amount} {order.currency}</span>
                </p>
              </div>
              <StatusPill status={order.status} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/app/worker/reviews/${order.id}`}
                className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Open Review
              </Link>
              <Link
                href={`/app/orders/${order.id}/audit`}
                className="border-2 border-[var(--color-border)] px-3 py-1.5 text-xs font-bold hover:border-[var(--color-border-strong)] transition-all"
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
