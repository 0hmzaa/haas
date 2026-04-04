"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "../../../../../../components/button";
import { Card } from "../../../../../../components/card";
import { PageContainer } from "../../../../../../components/page-container";
import { StatusPill } from "../../../../../../components/status-pill";
import { Stepper } from "../../../../../../components/stepper";
import { SkeletonCard } from "../../../../../../components/skeleton";
import { WalletSessionPanel } from "../../../../../../components/wallet-session-panel";
import {
  createPaymentRequirement,
  getOrderById,
  submitPayment,
} from "../../../../../../lib/api-client";
import { toHashscanTxUrl } from "../../../../../../lib/hedera-links";
import type { OrderSummary } from "../../../../../../lib/models";
import { useSession } from "../../../../../../lib/session-context";

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
  const { session } = useSession();
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
    if (!orderId) return;
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
                  asset: payload.currency,
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
    if (!session?.walletAddress) return;
    setPayerAccount(session.walletAddress);
  }, [session?.walletAddress]);

  const currentStep = (() => {
    if (message) return 3;
    if (requirement) return 2;
    if (order) return 1;
    return 0;
  })();

  const loadRequirement = async () => {
    try {
      if (!orderId) return;
      setError(null);
      setMessage(null);
      const payload = await createPaymentRequirement(orderId);
      setRequirement({
        x402PaymentId: payload.payment.x402PaymentId,
        paymentEndpoint: payload.payment.paymentEndpoint,
        network: payload.payment.x402.paymentRequirements.network,
        maxAmountRequired: payload.payment.x402.paymentRequirements.maxAmountRequired,
        payTo: payload.payment.x402.paymentRequirements.payTo,
        asset: payload.payment.x402.paymentRequirements.asset,
      });
      setMessage("Payment requirement created. Provide signed payload and submit.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create payment requirement");
    }
  };

  const submit = async () => {
    try {
      if (!orderId) return;
      if (!requirement?.x402PaymentId) throw new Error("Create payment requirement first");

      const signedPayload = JSON.parse(signedPayloadText);

      setSubmitting(true);
      setError(null);
      setMessage(null);

      const result = await submitPayment(orderId, {
        x402PaymentId: requirement.x402PaymentId,
        signedPayload,
        payerAccount: payerAccount.trim() || undefined,
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
      {!session?.walletAddress ? <WalletSessionPanel required /> : null}

      <Card variant="flat">
        <Stepper steps={["Order Summary", "Payment Requirement", "Submit Payment"]} currentStep={currentStep} />
      </Card>

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

      {loading ? <SkeletonCard /> : null}

      {/* Step 1: Order Summary */}
      {order ? (
        <Card>
          <h2 className="text-base font-bold">1. Order Summary</h2>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{order.title}</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{order.objective}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Amount: <span className="font-bold text-[var(--color-text)]">{order.amount} {order.currency}</span>
              </p>
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

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/app/client/orders/${order.id}`}
              className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Order Detail
            </Link>
            <Link
              href={`/app/orders/${order.id}/audit`}
              className="border-2 border-[var(--color-border)] px-3 py-1.5 text-xs font-bold hover:border-[var(--color-border-strong)] transition-all"
            >
              Open Audit
            </Link>
          </div>
        </Card>
      ) : null}

      {/* Step 2: Payment Requirement */}
      <Card>
        <h2 className="text-base font-bold">2. x402 Payment Requirement</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          This page triggers the same API-first flow used by agents: create payment requirement then submit signed payload.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Button variant="secondary" size="sm" onClick={loadRequirement}>
              Create / Refresh Requirement
            </Button>
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">Payer Account</label>
            <input
              value={payerAccount}
              onChange={(e) => setPayerAccount(e.target.value)}
              placeholder="Payer Hedera account (0.0.x)"
              className="mt-1 w-full"
            />
          </div>
        </div>

        {requirement ? (
          <div className="mt-4 border-2 border-[var(--color-border)] p-4">
            <h3 className="text-xs font-bold text-[var(--color-muted)]">Requirement Details</h3>
            <div className="mt-2 grid gap-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Network</span>
                <span className="font-mono font-bold">{requirement.network}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Pay to</span>
                <span className="font-mono font-bold">{requirement.payTo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Asset</span>
                <span className="font-bold">{requirement.asset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Max amount</span>
                <span className="font-bold">{requirement.maxAmountRequired}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Endpoint</span>
                <span className="font-mono font-bold">{requirement.paymentEndpoint}</span>
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Step 3: Submit */}
      <Card>
        <h2 className="text-base font-bold">3. Submit Signed Payment</h2>
        <div className="mt-3 grid gap-4">
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">x402 Payment ID</label>
            <input
              value={requirement?.x402PaymentId ?? ""}
              onChange={(e) =>
                setRequirement((current) =>
                  current ? { ...current, x402PaymentId: e.target.value } : null
                )
              }
              placeholder="x402PaymentId"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">Signed Payload (JSON)</label>
            <textarea
              value={signedPayloadText}
              onChange={(e) => setSignedPayloadText(e.target.value)}
              placeholder="Signed payload JSON"
              className="mt-1 min-h-32 w-full font-mono text-xs"
            />
          </div>
          <div>
            <Button onClick={submit} loading={submitting}>Submit Signed Payment</Button>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
