"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "../../../../../components/card";
import { PageContainer } from "../../../../../components/page-container";
import { WalletSessionPanel } from "../../../../../components/wallet-session-panel";
import { createOrder, listWorkers } from "../../../../../lib/api-client";
import type { WorkerProfile } from "../../../../../lib/models";
import { deriveClientNamespace, type HaasSession } from "../../../../../lib/session";

export default function CreateOrderPage() {
  const router = useRouter();

  const [session, setSession] = useState<HaasSession | null>(null);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [title, setTitle] = useState("On-site verification task");
  const [objective, setObjective] = useState("Verify real-world completion with clear proof");
  const [instructions, setInstructions] = useState(
    "Go to the provided location, execute the requested verification, and upload proof."
  );
  const [amount, setAmount] = useState("1.00");
  const [currency, setCurrency] = useState("HBAR");
  const [reviewWindowHours, setReviewWindowHours] = useState("72");
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingWorkers(true);
    setError(null);
    listWorkers({ availabilityStatus: "AVAILABLE" })
      .then((payload) => setWorkers(payload.items))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load workers")
      )
      .finally(() => setLoadingWorkers(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const value = new URLSearchParams(window.location.search).get("workerId");
    if (value) {
      setWorkerId(value);
    }
  }, []);

  const selectableWorkers = useMemo(
    () => workers.map((worker) => ({ id: worker.id, label: `${worker.displayName} (${worker.id})` })),
    [workers]
  );

  const submit = async () => {
    try {
      if (!session?.walletAddress) {
        throw new Error("Connect wallet session first");
      }

      if (!workerId.trim()) {
        throw new Error("Worker is required");
      }

      if (!title.trim() || !objective.trim() || !instructions.trim()) {
        throw new Error("Title, objective, and instructions are required");
      }

      const parsedReviewWindow = Number.parseInt(reviewWindowHours, 10);
      if (!Number.isInteger(parsedReviewWindow) || parsedReviewWindow < 0) {
        throw new Error("Review window must be an integer >= 0");
      }

      setSaving(true);
      setError(null);
      setMessage(null);

      const clientNamespace = deriveClientNamespace(session.walletAddress);

      const order = await createOrder({
        clientId: clientNamespace,
        clientAccountId: session.walletAddress,
        workerId: workerId.trim(),
        title: title.trim(),
        objective: objective.trim(),
        instructions: instructions.trim(),
        amount: amount.trim(),
        currency: currency.trim() || "HBAR",
        reviewWindowHours: parsedReviewWindow
      });

      setMessage(`Order created (${order.id}). Redirecting to payment page...`);
      router.push(`/app/client/orders/${order.id}/pay`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer
      title="Create Order"
      subtitle="Directly book one worker for one scoped real-world task."
    >
      <WalletSessionPanel onSessionChange={setSession} required />

      <Card>
        <h2 className="text-base font-semibold">Order Form</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-[var(--color-muted)]">Worker</label>
            <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
              <option value="">Select a worker</option>
              {selectableWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.label}
                </option>
              ))}
            </select>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
          <input
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            placeholder="Objective"
          />
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Task instructions"
            className="min-h-28 md:col-span-2"
          />
          <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" />
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            placeholder="Currency"
          />
          <input
            value={reviewWindowHours}
            onChange={(event) => setReviewWindowHours(event.target.value)}
            placeholder="Review window hours"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)] disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Order"}
          </button>
          {loadingWorkers ? <p className="text-xs text-[var(--color-muted)]">Loading workers...</p> : null}
          {message ? <p className="text-xs text-[var(--color-success)]">{message}</p> : null}
          {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
        </div>
      </Card>
    </PageContainer>
  );
}
