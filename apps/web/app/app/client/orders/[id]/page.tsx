"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../../components/button";
import { Card } from "../../../../../components/card";
import { OrderTimeline } from "../../../../../components/order-timeline";
import { PageContainer } from "../../../../../components/page-container";
import { StatusPill } from "../../../../../components/status-pill";
import { SkeletonCard } from "../../../../../components/skeleton";
import { WalletSessionPanel } from "../../../../../components/wallet-session-panel";
import {
  approveOrder,
  getDispute,
  getOrderById,
  getProofs,
  openDispute,
} from "../../../../../lib/api-client";
import { toHashscanTxUrl } from "../../../../../lib/hedera-links";
import type { DisputeDetail, OrderSummary, ProofArtifact } from "../../../../../lib/models";
import { useSession } from "../../../../../lib/session-context";
import { deriveClientNamespace } from "../../../../../lib/session";

type ClientOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

const DISPUTE_REASONS = [
  "QUALITY_ISSUE",
  "INCOMPLETE_WORK",
  "WRONG_DELIVERY",
  "OTHER",
] as const;

export default function ClientOrderDetailPage({ params }: ClientOrderDetailPageProps) {
  const { session } = useSession();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [proofs, setProofs] = useState<ProofArtifact[]>([]);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [reasonCode, setReasonCode] = useState<string>("QUALITY_ISSUE");
  const [clientStatement, setClientStatement] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setOrderId(resolved.id));
  }, [params]);

  const refresh = async (id: string) => {
    const [orderPayload, proofsPayload] = await Promise.all([getOrderById(id), getProofs(id)]);
    setOrder(orderPayload);
    setProofs(proofsPayload.items);

    if (orderPayload.status === "DISPUTED" || orderPayload.dispute) {
      const disputePayload = await getDispute(id);
      setDispute(disputePayload);
    } else {
      setDispute(null);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    refresh(orderId)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load order")
      )
      .finally(() => setLoading(false));
  }, [orderId]);

  const reviewDeadline = useMemo(() => {
    if (!order?.proofSubmittedAt) return null;
    const end = new Date(order.proofSubmittedAt).getTime() + order.reviewWindowHours * 3600000;
    return new Date(end);
  }, [order?.proofSubmittedAt, order?.reviewWindowHours]);

  const timeLeft = useMemo(() => {
    if (!reviewDeadline) return null;
    const diff = reviewDeadline.getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m remaining`;
  }, [reviewDeadline]);

  const onApprove = async () => {
    try {
      if (!orderId || !session?.walletAddress) throw new Error("Connect wallet to approve");
      setActing(true);
      setError(null);
      setMessage(null);
      const result = await approveOrder(orderId, {
        actorId: deriveClientNamespace(session.walletAddress),
        clientAccountId: session.walletAddress,
      });
      await refresh(orderId);
      setMessage(result.releaseTxId ? `Approved and released: ${result.releaseTxId}` : "Order approved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to approve");
    } finally {
      setActing(false);
    }
  };

  const onDispute = async () => {
    try {
      if (!orderId || !session?.walletAddress) throw new Error("Connect wallet to dispute");
      if (!clientStatement.trim()) throw new Error("Statement is required");
      setActing(true);
      setError(null);
      setMessage(null);
      const d = await openDispute(orderId, {
        reasonCode,
        clientStatement: clientStatement.trim(),
        actorId: deriveClientNamespace(session.walletAddress),
        clientAccountId: session.walletAddress,
      });
      await refresh(orderId);
      setMessage(`Dispute opened. Reviewers: ${d.assignedReviewerIds.join(", ")}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to dispute");
    } finally {
      setActing(false);
    }
  };

  if (!session?.walletAddress) {
    return (
      <PageContainer title="Order Detail" subtitle={orderId ? `Order ${orderId}` : "Order"}>
        <WalletSessionPanel required />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Order Detail" subtitle={orderId ? `Order ${orderId}` : "Order"}>
      {error ? (
        <Card variant="flat"><p className="text-sm font-semibold text-[var(--color-danger)]">{error}</p></Card>
      ) : null}
      {message ? (
        <Card variant="flat"><p className="text-sm font-semibold text-[var(--color-success)]">{message}</p></Card>
      ) : null}

      {loading ? <SkeletonCard /> : null}

      {!loading && order ? (
        <>
          <Card variant="flat">
            <OrderTimeline status={order.status} />
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{order.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{order.instructions}</p>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Worker: <span className="font-bold text-[var(--color-text)]">{order.workerId}</span> --
                  Amount: <span className="font-bold text-[var(--color-text)]">{order.amount} {order.currency}</span>
                </p>
                {timeLeft ? (
                  <p className="mt-1 text-xs font-bold text-[var(--color-accent)]">
                    Review window: {timeLeft}
                  </p>
                ) : null}
              </div>
              <StatusPill status={order.status} />
            </div>

            {order.funding?.hederaTxId ? (
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                Funding tx:{" "}
                <a href={toHashscanTxUrl(order.funding.hederaTxId)} target="_blank" rel="noreferrer" className="font-mono underline">
                  {order.funding.hederaTxId}
                </a>
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {order.status === "PAYMENT_PENDING" ? (
                <Link href={`/app/client/orders/${order.id}/pay`} className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)]">
                  Open Payment
                </Link>
              ) : null}
              <Link href={`/app/orders/${order.id}/audit`} className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)]">
                Open Audit
              </Link>
            </div>
          </Card>

          {/* Proofs */}
          <Card>
            <h3 className="text-base font-bold">Proof Artifacts</h3>
            {proofs.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">No proofs submitted yet.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {proofs.map((proof) => (
                  <div key={proof.id} className="border-2 border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
                    <p className="font-bold text-[var(--color-text)]">{proof.originalName}</p>
                    <p className="mt-1 font-mono">SHA256: {proof.sha256Hash.slice(0, 16)}...</p>
                    <p>Uploaded: {new Date(proof.uploadedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Review actions */}
          {order.status === "REVIEW_WINDOW" ? (
            <Card>
              <h3 className="text-base font-bold">Review Actions</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Approve for payout or open dispute for reviewer arbitration.
              </p>

              <div className="mt-4">
                <Button onClick={onApprove} loading={acting}>
                  Approve and Release Payment
                </Button>
              </div>

              <div className="mt-6 border-t-2 border-[var(--color-border)] pt-4">
                <h4 className="text-sm font-bold text-[var(--color-danger)]">Open Dispute</h4>
                <div className="mt-3 grid gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--color-muted)]">Reason</label>
                    <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="mt-1 w-full">
                      {DISPUTE_REASONS.map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--color-muted)]">Statement</label>
                    <textarea
                      value={clientStatement}
                      onChange={(e) => setClientStatement(e.target.value)}
                      placeholder="Explain why you are disputing..."
                      className="mt-1 min-h-24 w-full"
                    />
                  </div>
                  <Button variant="danger" onClick={onDispute} loading={acting}>
                    Open Dispute
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          {/* Dispute info */}
          {dispute ? (
            <Card>
              <h3 className="text-base font-bold">Dispute</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {dispute.reasonCode} -- {dispute.clientStatement}
              </p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Reviewers: {dispute.assignedReviewerIds.join(", ")}
              </p>
              <div className="mt-3 grid gap-1 text-xs text-[var(--color-muted)]">
                {dispute.votes.map((v) => (
                  <p key={`${v.reviewerId}-${v.submittedAt}`}>
                    <span className="font-bold text-[var(--color-text)]">{v.reviewerId}</span>: {v.vote} ({new Date(v.submittedAt).toLocaleString()})
                  </p>
                ))}
              </div>
              {dispute.resolution ? (
                <p className="mt-2 text-sm font-bold">Resolution: {dispute.resolution}</p>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}
