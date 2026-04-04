"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../../../components/card";
import { PageContainer } from "../../../../../components/page-container";
import { StatusPill } from "../../../../../components/status-pill";
import { SkeletonCard } from "../../../../../components/skeleton";
import { WalletSessionPanel } from "../../../../../components/wallet-session-panel";
import {
  getDispute,
  getOrderById,
  getProofs,
  voteDispute,
} from "../../../../../lib/api-client";
import type { DisputeDetail, OrderSummary, ProofArtifact } from "../../../../../lib/models";
import { useSession } from "../../../../../lib/session-context";

type ReviewOrderPageProps = {
  params: Promise<{ orderId: string }>;
};

const VOTE_OPTIONS = [
  {
    value: "RELEASE_TO_WORKER" as const,
    title: "Release to Worker",
    desc: "The work was completed satisfactorily. Release full payment.",
    color: "border-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-white",
  },
  {
    value: "SPLIT_PAYMENT" as const,
    title: "Split Payment",
    desc: "Partial completion. Split funds between worker and client.",
    color: "border-[var(--color-warning)] hover:bg-[var(--color-warning)] hover:text-white",
  },
  {
    value: "REFUND_CLIENT" as const,
    title: "Refund Client",
    desc: "Work was not completed or unacceptable. Full refund.",
    color: "border-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white",
  },
];

export default function ReviewOrderPage({ params }: ReviewOrderPageProps) {
  const { session } = useSession();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [proofs, setProofs] = useState<ProofArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setOrderId(resolved.orderId));
  }, [params]);

  const refresh = async (id: string) => {
    const [o, d, p] = await Promise.all([getOrderById(id), getDispute(id), getProofs(id)]);
    setOrder(o);
    setDispute(d);
    setProofs(p.items);
  };

  useEffect(() => {
    if (!orderId || !session?.walletAddress) {
      if (!session?.walletAddress) { setOrder(null); setDispute(null); setProofs([]); }
      return;
    }
    setLoading(true);
    setError(null);
    refresh(orderId)
      .catch((r: unknown) => setError(r instanceof Error ? r.message : "Unable to load review case"))
      .finally(() => setLoading(false));
  }, [orderId, session?.walletAddress]);

  const reviewerId = session?.verifiedHumanId ?? "";
  const reviewerAssigned = !!reviewerId && !!dispute?.assignedReviewerIds.includes(reviewerId);
  const reviewerVoted = !!reviewerId && !!dispute?.votes.some((v) => v.reviewerId === reviewerId);

  const voteTally = useMemo(() => {
    if (!dispute) return { release: 0, split: 0, refund: 0 };
    return dispute.votes.reduce(
      (acc, v) => {
        if (v.vote === "RELEASE_TO_WORKER") acc.release += 1;
        else if (v.vote === "SPLIT_PAYMENT") acc.split += 1;
        else if (v.vote === "REFUND_CLIENT") acc.refund += 1;
        return acc;
      },
      { release: 0, split: 0, refund: 0 }
    );
  }, [dispute]);

  const submitVote = async (vote: "RELEASE_TO_WORKER" | "SPLIT_PAYMENT" | "REFUND_CLIENT") => {
    try {
      if (!orderId || !reviewerId) throw new Error("Connect with verified reviewer identity");
      if (!reviewerAssigned) throw new Error("Not assigned to this dispute");
      if (reviewerVoted) throw new Error("Already voted");
      setSubmittingVote(true);
      setError(null);
      setMessage(null);
      const result = await voteDispute(orderId, { reviewerId, vote });
      await refresh(orderId);
      setMessage(result.resolved ? `Resolved: ${result.resolution}` : "Vote submitted. Waiting for others.");
    } catch (r) {
      setError(r instanceof Error ? r.message : "Unable to vote");
    } finally {
      setSubmittingVote(false);
    }
  };

  return (
    <PageContainer title="Review Case" subtitle={orderId ? `Order ${orderId}` : "Dispute review"}>
      {!session?.walletAddress ? <WalletSessionPanel required /> : null}

      {error ? <Card variant="flat"><p className="text-sm font-semibold text-[var(--color-danger)]">{error}</p></Card> : null}
      {message ? <Card variant="flat"><p className="text-sm font-semibold text-[var(--color-success)]">{message}</p></Card> : null}

      {loading && session?.walletAddress ? <SkeletonCard /> : null}

      {!loading && session?.walletAddress && order ? (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{order.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{order.instructions}</p>
              </div>
              <StatusPill status={order.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/app/orders/${order.id}/audit`} className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)]">
                Audit
              </Link>
              <Link href={`/app/client/orders/${order.id}`} className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)]">
                Client View
              </Link>
            </div>
          </Card>

          {dispute ? (
            <Card>
              <h3 className="text-base font-bold">Dispute Context</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                <span className="font-bold">Reason:</span> {dispute.reasonCode} -- {dispute.clientStatement}
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                <span className="font-bold">Worker:</span> {dispute.workerStatement || "No response yet."}
              </p>

              <div className="mt-4 flex gap-4 text-xs font-bold">
                <span className="text-[var(--color-success)]">Release: {voteTally.release}</span>
                <span className="text-[var(--color-warning)]">Split: {voteTally.split}</span>
                <span className="text-[var(--color-danger)]">Refund: {voteTally.refund}</span>
              </div>

              {dispute.resolution ? (
                <p className="mt-3 text-sm font-bold">Resolution: {dispute.resolution.replace(/_/g, " ")}</p>
              ) : null}
            </Card>
          ) : null}

          {/* Vote cards */}
          {dispute && !reviewerVoted && reviewerAssigned && dispute.status !== "RESOLVED" ? (
            <div className="grid gap-4 md:grid-cols-3">
              {VOTE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => submitVote(opt.value)}
                  disabled={submittingVote}
                  className={`border-2 bg-[var(--color-surface)] p-5 text-left transition-all disabled:opacity-50 ${opt.color} shadow-[4px_4px_0_var(--color-border-strong)] hover:shadow-[2px_2px_0_var(--color-border-strong)] hover:translate-x-[2px] hover:translate-y-[2px]`}
                >
                  <h4 className="text-base font-bold">{opt.title}</h4>
                  <p className="mt-2 text-sm">{opt.desc}</p>
                </button>
              ))}
            </div>
          ) : null}

          {!reviewerAssigned && session?.walletAddress ? (
            <Card variant="flat">
              <p className="text-xs font-semibold text-[var(--color-warning)]">
                Your reviewer identity is not assigned to this case.
              </p>
            </Card>
          ) : null}

          {reviewerVoted ? (
            <Card variant="flat">
              <p className="text-xs text-[var(--color-muted)]">Vote already submitted.</p>
            </Card>
          ) : null}

          {/* Proof artifacts */}
          <Card>
            <h3 className="text-base font-bold">Proof Artifacts</h3>
            {proofs.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">No proof artifacts.</p>
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
        </>
      ) : null}
    </PageContainer>
  );
}
