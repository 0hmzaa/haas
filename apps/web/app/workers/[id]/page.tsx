"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../components/card";
import { PageContainer } from "../../../components/page-container";
import { getWorkerById, getWorkerReputation } from "../../../lib/api-client";
import type { ReputationWorkerResponse, WorkerProfile } from "../../../lib/models";

type WorkerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function WorkerDetailPage({ params }: WorkerDetailPageProps) {
  const [workerId, setWorkerId] = useState<string>("");
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [reputation, setReputation] = useState<ReputationWorkerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    params.then((resolved) => {
      if (mounted) {
        setWorkerId(resolved.id);
      }
    });

    return () => {
      mounted = false;
    };
  }, [params]);

  useEffect(() => {
    if (!workerId) {
      return;
    }

    let mounted = true;

    const load = async () => {
      setError(null);
      try {
        const [workerPayload, reputationPayload] = await Promise.all([
          getWorkerById(workerId),
          getWorkerReputation(workerId)
        ]);
        if (mounted) {
          setWorker(workerPayload);
          setReputation(reputationPayload);
        }
      } catch (reason) {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : "Unable to load worker");
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [workerId]);

  return (
    <PageContainer
      title={worker?.displayName ?? "Worker Profile"}
      subtitle="One verified worker profile and direct booking."
      action={
        worker ? (
          <Link
            href={`/app/client/orders/new?workerId=${worker.id}`}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)]"
          >
            Book Worker
          </Link>
        ) : null
      }
    >
      {error ? (
        <Card>
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {!worker ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading profile...</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <h2 className="text-base font-semibold">About</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {worker.bio || "No worker description provided yet."}
            </p>
            <div className="mt-4 grid gap-2 text-sm text-[var(--color-muted)] md:grid-cols-2">
              <p>
                <span className="font-semibold text-[var(--color-text)]">Location:</span>{" "}
                {[worker.city, worker.country].filter(Boolean).join(", ") || "Not specified"}
              </p>
              <p>
                <span className="font-semibold text-[var(--color-text)]">Rate:</span>{" "}
                {worker.baseRate} HBAR / hour
              </p>
              <p>
                <span className="font-semibold text-[var(--color-text)]">Availability:</span>{" "}
                {worker.availabilityStatus}
              </p>
              <p>
                <span className="font-semibold text-[var(--color-text)]">Completed jobs:</span>{" "}
                {worker.completedJobs}
              </p>
            </div>
          </Card>
          <Card>
            <h2 className="text-base font-semibold">Trust</h2>
            <p className="mt-2 text-3xl font-bold">{worker.ratingAvg.toFixed(1)} / 5</p>
            <ul className="mt-3 space-y-1 text-sm text-[var(--color-muted)]">
              <li>Approval rate: {(worker.approvalRate * 100).toFixed(0)}%</li>
              <li>Dispute rate: {(worker.disputeRate * 100).toFixed(0)}%</li>
              <li>Reputation score: {worker.reputationScore.toFixed(2)}</li>
              {reputation ? <li>Outcome score: {reputation.score.toFixed(2)}</li> : null}
            </ul>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
