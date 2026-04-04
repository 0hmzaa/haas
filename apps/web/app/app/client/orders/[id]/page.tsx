"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../../../components/card";
import { PageContainer } from "../../../../../components/page-container";
import { StatusPill } from "../../../../../components/status-pill";
import { WalletSessionPanel } from "../../../../../components/wallet-session-panel";
import {
  approveOrder,
  getDispute,
  getOrderById,
  getProofs,
  openDispute
} from "../../../../../lib/api-client";
import { toHashscanTxUrl } from "../../../../../lib/hedera-links";
import type { DisputeDetail, OrderSummary, ProofArtifact } from "../../../../../lib/models";
import { deriveClientNamespace } from "../../../../../lib/session";
import type { HaasSession } from "../../../../../lib/session";

type ClientOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function ClientOrderDetailPage({ params }: ClientOrderDetailPageProps) {
  const [session, setSession] = useState<HaasSession | null>(null);
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [proofs, setProofs] = useState<ProofArtifact[]>([]);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [reasonCode, setReasonCode] = useState("QUALITY_ISSUE");
  const [clientStatement, setClientStatement] = useState("");
  const [loading, setLoading] = useState(false);
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
    if (!orderId) {
      return;
    }

    setLoading(true);
    setError(null);
    refresh(orderId)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load order detail")
      )
      .finally(() => setLoading(false));
  }, [orderId]);

  const reviewDeadline = useMemo(() => {
    if (!order?.proofSubmittedAt) {
      return null;
    }

    const start = new Date(order.proofSubmittedAt).getTime();
    const end = start + order.reviewWindowHours * 60 * 60 * 1000;
    return new Date(end);
  }, [order?.proofSubmittedAt, order?.reviewWindowHours]);

  const onApprove = async () => {
    try {
      if (!orderId || !session?.walletAddress) {
        throw new Error("Connect a wallet to approve this order");
      }

      setActing(true);
      setError(null);
      setMessage(null);

      const result = await approveOrder(orderId, deriveClientNamespace(session.walletAddress));
      await refresh(orderId);
      setMessage(
        result.releaseTxId
          ? `Order approved and released: ${result.releaseTxId}`
          : "Order approved"
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to approve order");
    } finally {
      setActing(false);
    }
  };

  const onDispute = async () => {
    try {
      if (!orderId) {
        return;
      }
      if (!session?.walletAddress) {
        throw new Error("Connect a wallet to open a dispute");
      }

      if (!clientStatement.trim()) {
        throw new Error("Client statement is required to open dispute");
      }

      setActing(true);
      setError(null);
      setMessage(null);

      const disputePayload = await openDispute(orderId, {
        reasonCode: reasonCode.trim(),
        clientStatement: clientStatement.trim(),
        actorId: deriveClientNamespace(session.walletAddress)
      });

      await refresh(orderId);
      setMessage(`Dispute opened with 3 reviewers: ${disputePayload.assignedReviewerIds.join(", ")}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open dispute");
    } finally {
      setActing(false);
    }
  };

  return (
    <PageContainer
      title="Client Order Detail"
      subtitle={orderId ? `Order ${orderId}` : "Order detail"}
    >
      <WalletSessionPanel onSessionChange={setSession} required />

      {loading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading order...</p>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {message ? (
        <Card>
          <p className="text-sm text-[var(--color-success)]">{message}</p>
        </Card>
      ) : null}

      {order ? (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{order.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{order.instructions}</p>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Worker: {order.workerId} · Amount: {order.amount} {order.currency}
                </p>
                {reviewDeadline ? (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Review window ends at: {reviewDeadline.toISOString()}
                  </p>
                ) : null}
              </div>
              <StatusPill status={order.status} />
            </div>

            {order.funding?.hederaTxId ? (
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                Funding tx: {" "}
                <a
                  href={toHashscanTxUrl(order.funding.hederaTxId)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {order.funding.hederaTxId}
                </a>
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {order.status === "PAYMENT_PENDING" ? (
                <Link
                  href={`/app/client/orders/${order.id}/pay`}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
                >
                  Open Payment
                </Link>
              ) : null}
              <Link
                href={`/app/orders/${order.id}/audit`}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
              >
                Open Audit
              </Link>
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold">Proof Artifacts</h3>
            {proofs.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">No proofs submitted yet.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {proofs.map((proof) => (
                  <div
                    key={proof.id}
                    className="rounded-xl border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]"
                  >
                    <p className="font-semibold text-[var(--color-text)]">{proof.originalName}</p>
                    <p>SHA256: {proof.sha256Hash}</p>
                    <p>Uploaded: {new Date(proof.uploadedAt).toISOString()}</p>
                    <p>Storage: {proof.localPath}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {order.status === "REVIEW_WINDOW" ? (
            <Card>
              <h3 className="text-base font-semibold">Review Actions</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Approve for payout or open dispute for reviewer arbitration.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={acting}
                  className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)] disabled:opacity-60"
                >
                  {acting ? "Processing..." : "Approve and Release"}
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <input
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                  placeholder="Reason code"
                />
                <textarea
                  value={clientStatement}
                  onChange={(event) => setClientStatement(event.target.value)}
                  placeholder="Client dispute statement"
                  className="min-h-24"
                />
                <button
                  type="button"
                  onClick={onDispute}
                  disabled={acting}
                  className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Open Dispute
                </button>
              </div>
            </Card>
          ) : null}

          {dispute ? (
            <Card>
              <h3 className="text-base font-semibold">Dispute</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {dispute.reasonCode} · {dispute.clientStatement}
              </p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Assigned reviewers: {dispute.assignedReviewerIds.join(", ")}
              </p>
              <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)]">
                {dispute.votes.map((vote) => (
                  <p key={`${vote.reviewerId}-${vote.submittedAt}`}>
                    {vote.reviewerId}: {vote.vote} ({new Date(vote.submittedAt).toISOString()})
                  </p>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}
