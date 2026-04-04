"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../../../components/card";
import { OrderTimeline } from "../../../../../components/order-timeline";
import { PageContainer } from "../../../../../components/page-container";
import { StatusPill } from "../../../../../components/status-pill";
import { SkeletonCard } from "../../../../../components/skeleton";
import { getAudit } from "../../../../../lib/api-client";
import {
  toHashscanAccountUrl,
  toHashscanTopicUrl,
  toHashscanTxUrl,
  toMirrorTopicUrl,
  toMirrorTxUrl,
} from "../../../../../lib/hedera-links";
import type { AuditTimelineResponse } from "../../../../../lib/models";

type OrderAuditPageProps = {
  params: Promise<{ id: string }>;
};

function Check({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-4 w-4 border-2 text-center text-[10px] font-bold leading-3 ${ok ? "border-[var(--color-success)] bg-[var(--color-success)] text-white" : "border-[var(--color-border)] text-[var(--color-muted)]"}`}>
      {ok ? "\u2713" : "\u2715"}
    </span>
  );
}

export default function OrderAuditPage({ params }: OrderAuditPageProps) {
  const [orderId, setOrderId] = useState("");
  const [audit, setAudit] = useState<AuditTimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setOrderId(resolved.id));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const p = await getAudit(orderId);
        if (!cancelled) setAudit(p);
      } catch (r: unknown) {
        if (!cancelled) setError(r instanceof Error ? r.message : "Unable to load audit");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [orderId]);

  const txIds = useMemo(() => {
    if (!audit) return [];
    const values = [
      audit.funding?.hederaTxId,
      audit.ledger?.fundingTxId,
      audit.ledger?.releaseTxId,
      audit.ledger?.refundTxId,
      ...audit.timeline.map((e) => e.txId),
    ].filter((v): v is string => typeof v === "string" && v.length > 0);
    return Array.from(new Set(values));
  }, [audit]);

  return (
    <PageContainer title="Order Audit" subtitle={orderId ? `Order ${orderId}` : "Hedera audit timeline"}>
      {loading ? <SkeletonCard /> : null}
      {error ? <Card variant="flat"><p className="text-sm font-semibold text-[var(--color-danger)]">{error}</p></Card> : null}

      {audit ? (
        <>
          <Card variant="flat">
            <OrderTimeline status={audit.order.status} />
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Order Status</h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">ID: <span className="font-mono">{audit.order.id}</span></p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">Proof: {audit.order.proofSubmittedAt ?? "n/a"}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">Schedule: {audit.order.scheduleId ?? "n/a"}</p>
              </div>
              <StatusPill status={audit.order.status} />
            </div>
          </Card>

          {/* Audit Checks */}
          <Card>
            <h2 className="text-base font-bold">Audit Checks</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["Funding Confirmed", audit.checks.fundingConfirmed],
                ["Proof Anchored", audit.checks.proofAnchored],
                ["Review Window Anchored", audit.checks.reviewWindowAnchored],
                ["Schedule Consistent", audit.checks.scheduleConsistent],
              ].map(([label, ok]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <Check ok={ok as boolean} />
                  <span className="text-xs font-semibold">{label as string}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Ledger */}
          <Card>
            <h2 className="text-base font-bold">Hedera Ledger</h2>
            <div className="mt-3 grid gap-1 text-xs text-[var(--color-muted)]">
              <p>Network: <span className="font-bold text-[var(--color-text)]">{audit.ledger?.hederaNetwork ?? "n/a"}</span></p>
              <p>Escrow: {audit.ledger?.escrowAccountId ? (
                <a href={toHashscanAccountUrl(audit.ledger.escrowAccountId)} target="_blank" rel="noreferrer" className="font-mono underline">{audit.ledger.escrowAccountId}</a>
              ) : "n/a"}</p>
              <p>Payer: <span className="font-mono">{audit.ledger?.payerAccount ?? "n/a"}</span></p>
              <p>Facilitator: <span className="font-mono">{audit.ledger?.facilitatorId ?? "n/a"}</span></p>
            </div>
          </Card>

          {/* Transactions */}
          {txIds.length > 0 ? (
            <Card>
              <h2 className="text-base font-bold">Transaction Links</h2>
              <div className="mt-3 grid gap-2">
                {txIds.map((txId) => (
                  <div key={txId} className="flex flex-wrap items-center gap-3 border-2 border-[var(--color-border)] p-3">
                    <span className="flex-1 break-all font-mono text-xs font-bold">{txId}</span>
                    <a href={toHashscanTxUrl(txId)} target="_blank" rel="noreferrer" className="border-2 border-[var(--color-border-strong)] px-2 py-1 text-[10px] font-bold shadow-[2px_2px_0_var(--color-border-strong)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                      HashScan
                    </a>
                    {audit.mirror?.baseUrl ? (
                      <a href={toMirrorTxUrl(audit.mirror.baseUrl, txId)} target="_blank" rel="noreferrer" className="border-2 border-[var(--color-border)] px-2 py-1 text-[10px] font-bold">
                        Mirror
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {/* HCS Timeline */}
          <Card>
            <h2 className="text-base font-bold">HCS Timeline</h2>
            {audit.timeline.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">No timeline events.</p>
            ) : (
              <div className="mt-4 relative border-l-2 border-[var(--color-border-strong)] ml-3">
                {audit.timeline.map((event, i) => (
                  <div key={`${event.eventType}-${event.timestamp}-${i}`} className="relative pl-6 pb-6 last:pb-0">
                    <div className="absolute -left-[7px] top-1 h-3 w-3 border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)]" />
                    <p className="text-sm font-bold">{event.eventType}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {new Date(event.timestamp).toLocaleString()}
                      {event.actorId ? ` -- ${event.actorId}` : ""}
                    </p>
                    {event.txId ? <p className="font-mono text-xs text-[var(--color-muted)]">tx: {event.txId}</p> : null}
                    {event.proofHash ? <p className="font-mono text-xs text-[var(--color-muted)]">proof: {event.proofHash.slice(0, 20)}...</p> : null}
                    {event.resolution ? <p className="text-xs font-bold text-[var(--color-accent)]">resolution: {event.resolution}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Mirror */}
          {audit.mirror ? (
            <Card>
              <h2 className="text-base font-bold">Mirror Node</h2>
              <div className="mt-3 grid gap-1 text-xs text-[var(--color-muted)]">
                <p>Base: <span className="font-mono">{audit.mirror.baseUrl}</span></p>
                <p>
                  Topic:{" "}
                  {audit.mirror.topicId ? (
                    <>
                      <a href={toHashscanTopicUrl(audit.mirror.topicId)} target="_blank" rel="noreferrer" className="font-mono underline">{audit.mirror.topicId}</a>
                      {" -- "}
                      <a href={toMirrorTopicUrl(audit.mirror.baseUrl, audit.mirror.topicId)} target="_blank" rel="noreferrer" className="underline">messages</a>
                    </>
                  ) : "n/a"}
                </p>
                <p>Transactions: {audit.mirror.transactions.length} -- Messages: {audit.mirror.topicMessages.length}</p>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}
