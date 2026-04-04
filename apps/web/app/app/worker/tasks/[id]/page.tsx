"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "../../../../../components/button";
import { Card } from "../../../../../components/card";
import { OrderTimeline } from "../../../../../components/order-timeline";
import { PageContainer } from "../../../../../components/page-container";
import { StatusPill } from "../../../../../components/status-pill";
import { SkeletonCard } from "../../../../../components/skeleton";
import { WalletSessionPanel } from "../../../../../components/wallet-session-panel";
import {
  getDispute,
  getOrderById,
  respondDispute,
  startOrder,
  uploadProof,
} from "../../../../../lib/api-client";
import type { DisputeDetail, OrderSummary } from "../../../../../lib/models";
import { useSession } from "../../../../../lib/session-context";

type WorkerTaskDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function WorkerTaskDetailPage({ params }: WorkerTaskDetailPageProps) {
  const { session } = useSession();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [workerStatement, setWorkerStatement] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    refresh(orderId)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load order")
      )
      .finally(() => setLoading(false));
  }, [orderId, session?.walletAddress]);

  const onStart = async () => {
    try {
      if (!orderId) return;
      if (!session?.workerId) throw new Error("Connect a wallet linked to a worker profile");
      if (order && order.workerId !== session.workerId) throw new Error("This task is assigned to another worker");
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
      if (!orderId || !file) throw new Error("Select a proof file first");
      if (!session?.workerId) throw new Error("Connect a wallet linked to a worker profile");
      if (order && order.workerId !== session.workerId) throw new Error("This task is assigned to another worker");
      setError(null);
      await uploadProof(orderId, { file, summary: summary.trim() || "Proof submitted" });
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
      if (!orderId) return;
      if (!session?.workerId) throw new Error("Connect a wallet linked to a worker profile");
      if (order && order.workerId !== session.workerId) throw new Error("This task is assigned to another worker");
      if (!workerStatement.trim()) throw new Error("Worker statement is required");
      await respondDispute(orderId, workerStatement.trim(), session?.verifiedHumanId ?? undefined);
      await refresh(orderId);
      setMessage("Dispute response submitted");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to respond to dispute");
    }
  };

  return (
    <PageContainer title="Task Detail" subtitle={orderId ? `Order ${orderId}` : "Order"}>
      {!session?.walletAddress ? (
        <WalletSessionPanel required />
      ) : null}

      {error ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}
      {message ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-success)]">{message}</p>
        </Card>
      ) : null}

      {loading && session?.walletAddress ? <SkeletonCard /> : null}

      {!loading && session?.walletAddress && order ? (
        <>
          <Card variant="flat">
            <OrderTimeline status={order.status} />
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{order.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{order.instructions}</p>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Amount: <span className="font-bold text-[var(--color-text)]">{order.amount} {order.currency}</span>
                </p>
              </div>
              <StatusPill status={order.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {order.status === "FUNDED" ? (
                <Button size="sm" onClick={onStart}>Start Order</Button>
              ) : null}
              <Link
                href={`/app/orders/${order.id}/audit`}
                className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)]"
              >
                Open Audit
              </Link>
            </div>
          </Card>

          {order.status === "IN_PROGRESS" ? (
            <Card>
              <h3 className="text-base font-bold">Submit Proof</h3>
              <div className="mt-4 grid gap-4">
                <div>
                  <label className="text-xs font-bold text-[var(--color-muted)]">Proof File</label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="mt-1 w-full"
                  />
                  {file ? (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      Selected: <span className="font-bold text-[var(--color-text)]">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-muted)]">Summary</label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Describe what the proof shows..."
                    className="mt-1 min-h-24 w-full"
                  />
                </div>
                <Button onClick={onSubmitProof}>Upload Proof</Button>
              </div>
            </Card>
          ) : null}

          {dispute ? (
            <Card>
              <h3 className="text-base font-bold text-[var(--color-danger)]">Dispute Response</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Reason: <span className="font-bold">{dispute.reasonCode}</span> -- {dispute.clientStatement}
              </p>
              <div className="mt-4">
                <label className="text-xs font-bold text-[var(--color-muted)]">Your Response</label>
                <textarea
                  value={workerStatement}
                  onChange={(e) => setWorkerStatement(e.target.value)}
                  placeholder="Explain your side for the reviewers..."
                  className="mt-1 min-h-24 w-full"
                />
              </div>
              <Button variant="secondary" className="mt-3" onClick={onRespondDispute}>
                Submit Dispute Response
              </Button>
            </Card>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}
