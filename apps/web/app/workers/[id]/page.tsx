"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "../../../components/badge";
import { Button } from "../../../components/button";
import { Card } from "../../../components/card";
import { PageContainer } from "../../../components/page-container";
import { SkeletonCard } from "../../../components/skeleton";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    params.then((resolved) => {
      if (mounted) setWorkerId(resolved.id);
    });
    return () => { mounted = false; };
  }, [params]);

  useEffect(() => {
    if (!workerId) return;
    let mounted = true;

    const load = async () => {
      setError(null);
      setLoading(true);
      try {
        const [workerPayload, reputationPayload] = await Promise.all([
          getWorkerById(workerId),
          getWorkerReputation(workerId),
        ]);
        if (mounted) {
          setWorker(workerPayload);
          setReputation(reputationPayload);
        }
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Unable to load worker");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [workerId]);

  return (
    <PageContainer
      title={worker?.displayName ?? "Worker Profile"}
      subtitle="Verified worker profile and direct booking."
      action={
        worker ? (
          <Link href={`/app/client/orders/new?workerId=${worker.id}`}>
            <Button size="sm">Book Worker</Button>
          </Link>
        ) : null
      }
    >
      {error ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2"><SkeletonCard /></div>
          <SkeletonCard />
        </div>
      ) : null}

      {!loading && worker ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <h2 className="text-base font-bold">About</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {worker.bio || "No worker description provided yet."}
            </p>

            {Array.isArray(worker.skills) && worker.skills.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(worker.skills as string[]).map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 text-xs text-[var(--color-muted)] md:grid-cols-2">
              <p>
                <span className="font-bold text-[var(--color-text)]">Location:</span>{" "}
                {[worker.city, worker.country].filter(Boolean).join(", ") || "Not specified"}
              </p>
              <p>
                <span className="font-bold text-[var(--color-text)]">Rate:</span>{" "}
                {worker.baseRate} HBAR / hour
              </p>
              <p>
                <span className="font-bold text-[var(--color-text)]">Availability:</span>{" "}
                <Badge variant={worker.availabilityStatus === "AVAILABLE" ? "success" : "outline"}>
                  {worker.availabilityStatus}
                </Badge>
              </p>
              <p>
                <span className="font-bold text-[var(--color-text)]">Completed jobs:</span>{" "}
                {worker.completedJobs}
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-bold">Trust</h2>
            <p className="mt-3 text-4xl font-black">{(worker.ratingAvg ?? 0).toFixed(1)}<span className="text-lg text-[var(--color-muted)]"> / 5</span></p>
            <div className="mt-4 grid gap-2 text-xs">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                <span className="text-[var(--color-muted)]">Approval rate</span>
                <span className="font-bold">{((worker.approvalRate ?? 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                <span className="text-[var(--color-muted)]">Dispute rate</span>
                <span className="font-bold">{((worker.disputeRate ?? 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                <span className="text-[var(--color-muted)]">Reputation</span>
                <span className="font-bold">{(worker.reputationScore ?? 0).toFixed(2)}</span>
              </div>
              {reputation?.score != null ? (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted)]">Outcome score</span>
                  <span className="font-bold">{reputation.score.toFixed(2)}</span>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}
