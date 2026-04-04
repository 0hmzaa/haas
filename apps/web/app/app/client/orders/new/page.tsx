"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../../../components/button";
import { Card } from "../../../../../components/card";
import { PageContainer } from "../../../../../components/page-container";
import { Stepper } from "../../../../../components/stepper";
import { WalletSessionPanel } from "../../../../../components/wallet-session-panel";
import { createOrder, listWorkers } from "../../../../../lib/api-client";
import type { WorkerProfile } from "../../../../../lib/models";
import { useSession } from "../../../../../lib/session-context";
import { deriveClientNamespace } from "../../../../../lib/session";

export default function CreateOrderPage() {
  const router = useRouter();
  const { session } = useSession();
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
    if (typeof window === "undefined") return;
    const value = new URLSearchParams(window.location.search).get("workerId");
    if (value) setWorkerId(value);
  }, []);

  const selectableWorkers = useMemo(
    () => workers.map((w) => ({ id: w.id, label: `${w.displayName} (${w.id})` })),
    [workers]
  );

  const selectedWorker = useMemo(
    () => workers.find((w) => w.id === workerId),
    [workers, workerId]
  );

  const currentStep = useMemo(() => {
    if (message) return 3;
    if (workerId && title.trim() && objective.trim()) return 2;
    if (workerId) return 1;
    return 0;
  }, [workerId, title, objective, message]);

  const submit = async () => {
    try {
      if (!session?.walletAddress) throw new Error("Connect wallet session first");
      if (!workerId.trim()) throw new Error("Worker is required");
      if (!title.trim() || !objective.trim() || !instructions.trim()) throw new Error("Title, objective, and instructions are required");

      const parsedReviewWindow = Number.parseInt(reviewWindowHours, 10);
      if (!Number.isInteger(parsedReviewWindow) || parsedReviewWindow < 0) throw new Error("Review window must be an integer >= 0");

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
        reviewWindowHours: parsedReviewWindow,
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
    <PageContainer title="Create Order" subtitle="Directly book one worker for one scoped real-world task.">
      {!session?.walletAddress ? <WalletSessionPanel required /> : null}

      <Card variant="flat">
        <Stepper steps={["Select Worker", "Task Details", "Review & Submit"]} currentStep={currentStep} />
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

      {/* Step 1: Select Worker */}
      <Card>
        <h2 className="text-base font-bold">1. Select Worker</h2>
        <div className="mt-3">
          <label className="text-xs font-bold text-[var(--color-muted)]">Worker</label>
          <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="mt-1 w-full">
            <option value="">Select a worker</option>
            {selectableWorkers.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
          {loadingWorkers ? <p className="mt-1 text-xs text-[var(--color-muted)]">Loading available workers...</p> : null}
        </div>

        {selectedWorker ? (
          <div className="mt-3 border-2 border-[var(--color-border)] p-3">
            <p className="text-sm font-bold">{selectedWorker.displayName}</p>
            <p className="text-xs text-[var(--color-muted)]">
              {[selectedWorker.city, selectedWorker.country].filter(Boolean).join(", ")} -- {selectedWorker.baseRate} HBAR/hr
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{selectedWorker.bio || "No bio"}</p>
          </div>
        ) : null}
      </Card>

      {/* Step 2: Task Details */}
      <Card>
        <h2 className="text-base font-bold">2. Task Details</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">Objective *</label>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objective" className="mt-1 w-full" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-[var(--color-muted)]">Instructions *</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Task instructions"
              className="mt-1 min-h-28 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">Amount</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Currency" className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">Review Window (hours)</label>
            <input value={reviewWindowHours} onChange={(e) => setReviewWindowHours(e.target.value)} placeholder="72" className="mt-1 w-full" />
          </div>
        </div>
      </Card>

      {/* Step 3: Summary & Submit */}
      {workerId && title.trim() ? (
        <Card>
          <h2 className="text-base font-bold">3. Review & Submit</h2>
          <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)]">
            <p>Worker: <span className="font-bold text-[var(--color-text)]">{selectedWorker?.displayName ?? workerId}</span></p>
            <p>Title: <span className="font-bold text-[var(--color-text)]">{title}</span></p>
            <p>Amount: <span className="font-bold text-[var(--color-text)]">{amount} {currency}</span></p>
            <p>Review window: <span className="font-bold text-[var(--color-text)]">{reviewWindowHours}h</span></p>
          </div>
          <div className="mt-4">
            <Button onClick={submit} loading={saving}>Create Order</Button>
          </div>
        </Card>
      ) : null}
    </PageContainer>
  );
}
