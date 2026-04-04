"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../../../components/card";
import { PageContainer } from "../../../../../components/page-container";
import { StatusPill } from "../../../../../components/status-pill";
import { WalletSessionPanel } from "../../../../../components/wallet-session-panel";
import {
  getDispute,
  getOrderById,
  respondDispute,
  startOrder,
  uploadProof
} from "../../../../../lib/api-client";
import type { DisputeDetail, OrderSummary } from "../../../../../lib/models";
import type { HaasSession } from "../../../../../lib/session";

type WorkerTaskDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function WorkerTaskDetailPage({ params }: WorkerTaskDetailPageProps) {
  const [session, setSession] = useState<HaasSession | null>(null);
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [workerStatement, setWorkerStatement] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setOrderId(resolved.id));
  }, [params]);

  const refresh = async (id: string) => {
    const orderPayload = await getOrderById(id);
    setOrder(orderPayload);
    if (orderPayload.status === "DISPUTED") {
      const disputePayload = await getDispute(id);
      setDispute(disputePayload);
    } else {
      setDispute(null);
    }
  };

  useEffect(() => {
    if (!orderId || !session?.walletAddress) {
      if (!session?.walletAddress) {
        setOrder(null);
        setDispute(null);
      }
      return;
    }
    refresh(orderId).catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Unable to load order")
    );
  }, [orderId, session?.walletAddress]);

  const onStart = async () => {
    try {
      if (!orderId) {
        return;
      }
      if (!session?.workerId) {
        throw new Error("Connect a wallet linked to a worker profile");
      }
      if (order && order.workerId !== session.workerId) {
        throw new Error("This task is assigned to another worker");
      }
      setError(null);
      const payload = await startOrder(orderId);
      setOrder(payload);
      setMessage("Order moved to IN_PROGRESS");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start order");
    }
  };

  const onSubmitProof = async () => {
    try {
      if (!orderId || !file) {
        throw new Error("Select a proof file first");
      }
      if (!session?.workerId) {
        throw new Error("Connect a wallet linked to a worker profile");
      }
      if (order && order.workerId !== session.workerId) {
        throw new Error("This task is assigned to another worker");
      }
      setError(null);
      await uploadProof(orderId, {
        file,
        summary: summary.trim() || "Proof submitted"
      });
      setSummary("");
      setFile(null);
      await refresh(orderId);
      setMessage("Proof submitted");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload proof");
    }
  };

  const onRespondDispute = async () => {
    try {
      if (!orderId) {
        return;
      }
      if (!session?.workerId) {
        throw new Error("Connect a wallet linked to a worker profile");
      }
      if (order && order.workerId !== session.workerId) {
        throw new Error("This task is assigned to another worker");
      }
      if (!workerStatement.trim()) {
        throw new Error("Worker statement is required");
      }
      await respondDispute(orderId, workerStatement.trim(), session?.verifiedHumanId ?? undefined);
      await refresh(orderId);
      setMessage("Dispute response submitted");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to respond to dispute");
    }
  };

  return (
    <PageContainer title="Task Detail" subtitle={orderId ? `Order ${orderId}` : "Order"}>
      <WalletSessionPanel onSessionChange={setSession} required />

      {!session?.walletAddress ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            Connect HashPack to access worker task details.
          </p>
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

      {!session?.walletAddress ? null : !order ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading order...</p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{order.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{order.instructions}</p>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Amount: {order.amount} {order.currency}
                </p>
              </div>
              <StatusPill status={order.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onStart}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
              >
                Start Order
              </button>
              <Link
                href={`/app/orders/${order.id}/audit`}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
              >
                Open Audit
              </Link>
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold">Submit Proof</h3>
            <div className="mt-3 grid gap-3">
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Proof summary"
                className="min-h-24"
              />
              <button
                type="button"
                onClick={onSubmitProof}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)]"
              >
                Upload Proof
              </button>
            </div>
          </Card>

          {dispute ? (
            <Card>
              <h3 className="text-base font-semibold">Dispute Response</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Reason: {dispute.reasonCode} — {dispute.clientStatement}
              </p>
              <textarea
                value={workerStatement}
                onChange={(event) => setWorkerStatement(event.target.value)}
                placeholder="Provide your response for reviewers"
                className="mt-3 min-h-24"
              />
              <button
                type="button"
                onClick={onRespondDispute}
                className="mt-3 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold"
              >
                Submit Dispute Response
              </button>
            </Card>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
