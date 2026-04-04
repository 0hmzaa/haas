"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../../../components/card";
import { PageContainer } from "../../../../../components/page-container";
import { StatusPill } from "../../../../../components/status-pill";
import { getAudit } from "../../../../../lib/api-client";
import {
  toHashscanAccountUrl,
  toHashscanTopicUrl,
  toHashscanTxUrl,
  toMirrorTopicUrl,
  toMirrorTxUrl
} from "../../../../../lib/hedera-links";
import type { AuditTimelineResponse } from "../../../../../lib/models";

type OrderAuditPageProps = {
  params: Promise<{ id: string }>;
};

function yesNo(value: boolean): string {
  return value ? "YES" : "NO";
}

export default function OrderAuditPage({ params }: OrderAuditPageProps) {
  const [orderId, setOrderId] = useState("");
  const [audit, setAudit] = useState<AuditTimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setOrderId(resolved.id));
  }, [params]);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getAudit(orderId);
        if (!cancelled) {
          setAudit(payload);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Unable to load audit timeline");
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
  }, [orderId]);

  const txIds = useMemo(() => {
    if (!audit) {
      return [];
    }

    const values = [
      audit.funding?.hederaTxId,
      audit.ledger?.fundingTxId,
      audit.ledger?.releaseTxId,
      audit.ledger?.refundTxId,
      ...audit.timeline.map((item) => item.txId)
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    return Array.from(new Set(values));
  }, [audit]);

  return (
    <PageContainer title="Order Audit" subtitle={orderId ? `Order ${orderId}` : "Hedera audit timeline"}>
      {loading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading audit...</p>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {audit ? (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Order Status</h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">ID: {audit.order.id}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  proofSubmittedAt: {audit.order.proofSubmittedAt ?? "n/a"}
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  scheduleId: {audit.order.scheduleId ?? "n/a"}
                </p>
              </div>
              <StatusPill status={audit.order.status} />
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold">Audit Checks</h2>
            <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)] md:grid-cols-2">
              <p>fundingConfirmed: {yesNo(audit.checks.fundingConfirmed)}</p>
              <p>proofAnchored: {yesNo(audit.checks.proofAnchored)}</p>
              <p>reviewWindowAnchored: {yesNo(audit.checks.reviewWindowAnchored)}</p>
              <p>scheduleConsistent: {yesNo(audit.checks.scheduleConsistent)}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold">Hedera Ledger</h2>
            <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)]">
              <p>network: {audit.ledger?.hederaNetwork ?? "n/a"}</p>
              <p>
                escrow account: {" "}
                {audit.ledger?.escrowAccountId ? (
                  <a
                    href={toHashscanAccountUrl(audit.ledger.escrowAccountId)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {audit.ledger.escrowAccountId}
                  </a>
                ) : (
                  "n/a"
                )}
              </p>
              <p>payer account: {audit.ledger?.payerAccount ?? "n/a"}</p>
              <p>facilitator: {audit.ledger?.facilitatorId ?? "n/a"}</p>
              <p>funding tx: {audit.ledger?.fundingTxId ?? "n/a"}</p>
              <p>release tx: {audit.ledger?.releaseTxId ?? "n/a"}</p>
              <p>refund tx: {audit.ledger?.refundTxId ?? "n/a"}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold">Transaction Links</h2>
            {txIds.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">No transaction IDs available.</p>
            ) : (
              <div className="mt-3 grid gap-2 text-xs">
                {txIds.map((txId) => (
                  <div
                    key={txId}
                    className="rounded-xl border border-[var(--color-border)] p-3 text-[var(--color-muted)]"
                  >
                    <p className="break-all font-semibold text-[var(--color-text)]">{txId}</p>
                    <div className="mt-1 flex flex-wrap gap-3">
                      <a href={toHashscanTxUrl(txId)} target="_blank" rel="noreferrer" className="underline">
                        HashScan
                      </a>
                      {audit.mirror?.baseUrl ? (
                        <a
                          href={toMirrorTxUrl(audit.mirror.baseUrl, txId)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          Mirror Node
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold">HCS Timeline</h2>
            {audit.timeline.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">No timeline events.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {audit.timeline.map((event) => (
                  <div
                    key={`${event.eventType}-${event.timestamp}-${event.txId ?? "none"}`}
                    className="rounded-xl border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]"
                  >
                    <p className="font-semibold text-[var(--color-text)]">{event.eventType}</p>
                    <p>timestamp: {new Date(event.timestamp).toISOString()}</p>
                    <p>actor: {event.actorId ?? "n/a"}</p>
                    <p>txId: {event.txId ?? "n/a"}</p>
                    <p>resolution: {event.resolution ?? "n/a"}</p>
                    <p>proofHash: {event.proofHash ?? "n/a"}</p>
                    <p>storageRef: {event.storageRef ?? "n/a"}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {audit.mirror ? (
            <Card>
              <h2 className="text-base font-semibold">Mirror View</h2>
              <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)]">
                <p>Mirror base: {audit.mirror.baseUrl}</p>
                <p>
                  Topic: {" "}
                  {audit.mirror.topicId ? (
                    <>
                      <a
                        href={toHashscanTopicUrl(audit.mirror.topicId)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {audit.mirror.topicId}
                      </a>
                      {" · "}
                      <a
                        href={toMirrorTopicUrl(audit.mirror.baseUrl, audit.mirror.topicId)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        topic messages
                      </a>
                    </>
                  ) : (
                    "n/a"
                  )}
                </p>
                <p>Mirror tx matches: {audit.mirror.transactions.length}</p>
                <p>Mirror topic messages: {audit.mirror.topicMessages.length}</p>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}
