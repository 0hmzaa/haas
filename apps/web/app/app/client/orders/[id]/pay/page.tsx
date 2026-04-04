"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../../../../components/card";
import { PageContainer } from "../../../../../../components/page-container";
import { StatusPill } from "../../../../../../components/status-pill";
import { WalletSessionPanel } from "../../../../../../components/wallet-session-panel";
import {
  createPaymentRequirement,
  getOrderById,
  submitPayment
} from "../../../../../../lib/api-client";
import { toHashscanTxUrl } from "../../../../../../lib/hedera-links";
import type { OrderSummary } from "../../../../../../lib/models";
import type { HaasSession } from "../../../../../../lib/session";

type PayOrderPageProps = {
  params: Promise<{ id: string }>;
};

type RequirementState = {
  x402PaymentId: string;
  paymentEndpoint: string;
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
} | null;

export default function PayOrderPage({ params }: PayOrderPageProps) {
  const [session, setSession] = useState<HaasSession | null>(null);
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [requirement, setRequirement] = useState<RequirementState>(null);
  const [signedPayloadText, setSignedPayloadText] = useState('{"x402": "signed-payload"}');
  const [payerAccount, setPayerAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setOrderId(resolved.id));
  }, [params]);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    setLoading(true);
    setError(null);
    getOrderById(orderId)
      .then((payload) => {
        setOrder(payload);
        if (payload.funding?.x402PaymentId) {
          setRequirement((current) =>
            current
              ? current
              : {
                  x402PaymentId: payload.funding?.x402PaymentId ?? "",
                  paymentEndpoint: `/api/orders/${payload.id}/pay/submit`,
                  network: "hedera-testnet",
                  maxAmountRequired: payload.amount,
                  payTo: payload.funding?.payerAccount ?? "escrow",
                  asset: payload.currency
                }
          );
        }
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load order")
      )
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!session?.walletAddress) {
      return;
    }

    setPayerAccount(session.walletAddress);
  }, [session?.walletAddress]);

  const loadRequirement = async () => {
    try {
      if (!orderId) {
        return;
      }

      setError(null);
      setMessage(null);
      const payload = await createPaymentRequirement(orderId);
      setRequirement({
        x402PaymentId: payload.payment.x402PaymentId,
        paymentEndpoint: payload.payment.paymentEndpoint,
        network: payload.payment.x402.paymentRequirements.network,
        maxAmountRequired: payload.payment.x402.paymentRequirements.maxAmountRequired,
        payTo: payload.payment.x402.paymentRequirements.payTo,
        asset: payload.payment.x402.paymentRequirements.asset
      });
      setMessage("Payment requirement created. Provide signed payload and submit.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create payment requirement");
    }
  };

  const submit = async () => {
    try {
      if (!orderId) {
        return;
      }

      if (!requirement?.x402PaymentId) {
        throw new Error("Create payment requirement first");
      }

      const signedPayload = JSON.parse(signedPayloadText);

      setSubmitting(true);
      setError(null);
      setMessage(null);

      const result = await submitPayment(orderId, {
        x402PaymentId: requirement.x402PaymentId,
        signedPayload,
        payerAccount: payerAccount.trim() || undefined
      });

      const refreshedOrder = await getOrderById(orderId);
      setOrder(refreshedOrder);

      if (result.hederaTxId) {
        setMessage(`Payment submitted and funded on Hedera: ${result.hederaTxId}`);
      } else {
        setMessage("Payment submitted. Waiting for final Hedera tx metadata.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer title="Fund Order" subtitle={orderId ? `Order ${orderId}` : "Order payment"}>
      <WalletSessionPanel onSessionChange={setSession} required />

      {loading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading order...</p>
        </Card>
      ) : null}

      {order ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{order.title}</h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{order.objective}</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Amount: {order.amount} {order.currency}
              </p>
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
            <Link
              href={`/app/client/orders/${order.id}`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
            >
              Open Order Detail
            </Link>
            <Link
              href={`/app/orders/${order.id}/audit`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold"
            >
              Open Audit
            </Link>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-base font-semibold">x402 Funding</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          This page triggers the same API-first flow used by agents: create payment requirement then submit signed payload.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={loadRequirement}
            className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold"
          >
            Create / Refresh Requirement
          </button>
          <input
            value={payerAccount}
            onChange={(event) => setPayerAccount(event.target.value)}
            placeholder="Payer Hedera account (0.0.x)"
          />
          <input
            value={requirement?.x402PaymentId ?? ""}
            onChange={(event) =>
              setRequirement((current) =>
                current
                  ? {
                      ...current,
                      x402PaymentId: event.target.value
                    }
                  : null
              )
            }
            placeholder="x402PaymentId"
            className="md:col-span-2"
          />
          <textarea
            value={signedPayloadText}
            onChange={(event) => setSignedPayloadText(event.target.value)}
            placeholder="Signed payload JSON"
            className="min-h-40 md:col-span-2"
          />
        </div>

        {requirement ? (
          <div className="mt-3 rounded-xl border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
            <p>network: {requirement.network}</p>
            <p>payTo: {requirement.payTo}</p>
            <p>asset: {requirement.asset}</p>
            <p>maxAmountRequired: {requirement.maxAmountRequired}</p>
            <p>submit endpoint: {requirement.paymentEndpoint}</p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)] disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit Signed Payment"}
          </button>
          {message ? <p className="text-xs text-[var(--color-success)]">{message}</p> : null}
          {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
        </div>
      </Card>
    </PageContainer>
  );
}
