"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../../../components/card";
import { PageContainer } from "../../../../../components/page-container";
import { StatusPill } from "../../../../../components/status-pill";
import { WalletSessionPanel } from "../../../../../components/wallet-session-panel";
import {
  getDispute,
  getOrderById,
  getProofs,
  voteDispute
} from "../../../../../lib/api-client";
import type { DisputeDetail, OrderSummary, ProofArtifact } from "../../../../../lib/models";
import { useSession } from "../../../../../lib/session-context";

type ReviewOrderPageProps = {
  params: Promise<{ orderId: string }>;
};

const VOTE_OPTIONS = [
  "RELEASE_TO_WORKER",
  "SPLIT_PAYMENT",
  "REFUND_CLIENT"
] as const;

export default function ReviewOrderPage({ params }: ReviewOrderPageProps) {
  const { session } = useSession();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [proofs, setProofs] = useState<ProofArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setOrderId(resolved.orderId));
  }, [params]);

  const refresh = async (id: string) => {
    const [orderPayload, disputePayload, proofsPayload] = await Promise.all([
      getOrderById(id),
      getDispute(id),
      getProofs(id)
    ]);

    setOrder(orderPayload);
    setDispute(disputePayload);
    setProofs(proofsPayload.items);
  };

  useEffect(() => {
    if (!orderId || !session?.walletAddress) {
      if (!session?.walletAddress) {
        setOrder(null);
        setDispute(null);
        setProofs([]);
      }
      return;
    }

    setLoading(true);
    setError(null);
    refresh(orderId)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load review case")
      )
      .finally(() => setLoading(false));
  }, [orderId, session?.walletAddress]);

  const reviewerId = session?.verifiedHumanId ?? "";
  const reviewerAssigned =
    !!reviewerId && !!dispute?.assignedReviewerIds.includes(reviewerId);
  const reviewerVoted =
    !!reviewerId && !!dispute?.votes.some((vote) => vote.reviewerId === reviewerId);

  const voteTally = useMemo(() => {
    if (!dispute) {
      return {
        release: 0,
        split: 0,
        refund: 0
      };
    }

    return dispute.votes.reduce(
      (acc, vote) => {
        if (vote.vote === "RELEASE_TO_WORKER") {
          acc.release += 1;
        } else if (vote.vote === "SPLIT_PAYMENT") {
          acc.split += 1;
        } else if (vote.vote === "REFUND_CLIENT") {
          acc.refund += 1;
        }

        return acc;
      },
      {
        release: 0,
        split: 0,
        refund: 0
      }
    );
  }, [dispute]);

  const submitVote = async (vote: (typeof VOTE_OPTIONS)[number]) => {
    try {
      if (!orderId) {
        return;
      }

      if (!reviewerId) {
        throw new Error("Connect a wallet session with verified reviewer identity");
      }

      if (!reviewerAssigned) {
        throw new Error("Current reviewer is not assigned to this dispute");
      }

      if (reviewerVoted) {
        throw new Error("Reviewer has already submitted a vote for this dispute");
      }

      setSubmittingVote(true);
      setError(null);
      setMessage(null);

      const result = await voteDispute(orderId, {
        reviewerId,
        vote
      });

      await refresh(orderId);
      if (result.resolved) {
        setMessage(`Vote submitted. Case resolved: ${result.resolution}.`);
      } else {
        setMessage("Vote submitted. Waiting for other reviewers.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit reviewer vote");
    } finally {
      setSubmittingVote(false);
    }
  };

  return (
    <PageContainer title="Review Case" subtitle={orderId ? `Order ${orderId}` : "Dispute review"}>
      <WalletSessionPanel required />

      {!session?.walletAddress ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            Connect HashPack to access review cases.
          </p>
        </Card>
      ) : null}

      {session?.walletAddress && loading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading review case...</p>
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

      {session?.walletAddress && order ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{order.title}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{order.instructions}</p>
            </div>
            <StatusPill status={order.status} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/app/orders/${order.id}/audit`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
            >
              Open Audit
            </Link>
            <Link
              href={`/app/client/orders/${order.id}`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
            >
              Open Client View
            </Link>
          </div>
        </Card>
      ) : null}

      {session?.walletAddress && dispute ? (
        <Card>
          <h3 className="text-base font-semibold">Dispute Context</h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Reason: {dispute.reasonCode} · {dispute.clientStatement}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Worker statement: {dispute.workerStatement || "Not provided yet."}
          </p>

          <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)]">
            <p>
              Assigned reviewers: {dispute.assignedReviewerIds.join(", ")}
            </p>
            <p>
              Votes: RELEASE {voteTally.release} · SPLIT {voteTally.split} · REFUND {voteTally.refund}
            </p>
            <p>
              Resolution: {dispute.resolution ?? "Pending"}
            </p>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {VOTE_OPTIONS.map((vote) => (
              <button
                key={vote}
                type="button"
                onClick={() => submitVote(vote)}
                disabled={submittingVote || !reviewerAssigned || reviewerVoted || dispute.status === "RESOLVED"}
                className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {vote}
              </button>
            ))}
          </div>

          {!reviewerAssigned ? (
            <p className="mt-2 text-xs text-[var(--color-warning)]">
              Current reviewer identity is not assigned to this case.
            </p>
          ) : null}
          {reviewerVoted ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">Vote already submitted by this reviewer.</p>
          ) : null}
        </Card>
      ) : null}

      {session?.walletAddress ? (
        <Card>
          <h3 className="text-base font-semibold">Proof Artifacts for Review</h3>
          {proofs.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">No proof artifacts attached.</p>
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
      ) : null}
    </PageContainer>
  );
}
