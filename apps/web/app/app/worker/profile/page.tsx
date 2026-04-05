"use client";

import { useEffect, useState } from "react";
import { Badge } from "../../../../components/badge";
import { Button } from "../../../../components/button";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { SkeletonCard } from "../../../../components/skeleton";
import { WalletSessionPanel } from "../../../../components/wallet-session-panel";
import { getWorkerById, updateWorker } from "../../../../lib/api-client";
import type { WorkerProfile } from "../../../../lib/models";
import { useSession } from "../../../../lib/session-context";

const AVAILABILITY_OPTIONS = ["AVAILABLE", "BUSY", "OFFLINE"] as const;

export default function WorkerProfilePage() {
  const { session } = useSession();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.workerId) {
      setWorker(null);
      return;
    }

    setLoading(true);
    setError(null);
    getWorkerById(session.workerId)
      .then((payload) => setWorker(payload))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load worker profile")
      )
      .finally(() => setLoading(false));
  }, [session?.workerId]);

  const save = async () => {
    try {
      if (!worker) throw new Error("No worker profile loaded");
      setSaving(true);
      setError(null);
      setMessage(null);
      const updated = await updateWorker(worker.id, {
        displayName: worker.displayName,
        bio: worker.bio ?? "",
        country: worker.country ?? "",
        city: worker.city ?? "",
        timezone: worker.timezone ?? "",
        baseRate: worker.baseRate,
        availabilityStatus: worker.availabilityStatus,
      });
      setWorker(updated);
      setMessage("Profile updated");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (!session?.walletAddress) {
    return (
      <PageContainer title="Worker Profile" subtitle="Manage profile and availability.">
        <WalletSessionPanel required />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Worker Profile" subtitle="Manage profile and availability.">
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

      {!session?.workerId ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-muted)]">
            No worker linked to this wallet yet. Complete onboarding first.
          </p>
        </Card>
      ) : null}

      {loading ? <SkeletonCard /> : null}

      {!loading && worker ? (
        <>
          {Array.isArray(worker.skills) && worker.skills.length > 0 ? (
            <Card variant="flat">
              <p className="text-xs font-bold text-[var(--color-muted)]">Skills</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(worker.skills as string[]).map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="text-base font-bold">Edit Profile</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-[var(--color-muted)]">Display Name</label>
                <input
                  value={worker.displayName}
                  onChange={(e) => setWorker({ ...worker, displayName: e.target.value })}
                  placeholder="Display name"
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--color-muted)]">Hourly Rate (HBAR)</label>
                <input
                  value={worker.baseRate}
                  onChange={(e) => setWorker({ ...worker, baseRate: e.target.value })}
                  placeholder="Base rate in HBAR"
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--color-muted)]">Country</label>
                <input
                  value={worker.country ?? ""}
                  onChange={(e) => setWorker({ ...worker, country: e.target.value })}
                  placeholder="Country"
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--color-muted)]">City</label>
                <input
                  value={worker.city ?? ""}
                  onChange={(e) => setWorker({ ...worker, city: e.target.value })}
                  placeholder="City"
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--color-muted)]">Timezone</label>
                <input
                  value={worker.timezone ?? ""}
                  onChange={(e) => setWorker({ ...worker, timezone: e.target.value })}
                  placeholder="Timezone"
                  className="mt-1 w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--color-muted)]">Availability</label>
                <select
                  value={worker.availabilityStatus}
                  onChange={(e) => setWorker({ ...worker, availabilityStatus: e.target.value })}
                  className="mt-1 w-full"
                >
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-[var(--color-muted)]">Bio</label>
                <textarea
                  value={worker.bio ?? ""}
                  onChange={(e) => setWorker({ ...worker, bio: e.target.value })}
                  placeholder="Tell clients about yourself and your experience..."
                  className="mt-1 min-h-28 w-full"
                />
              </div>
            </div>

            <div className="mt-5">
              <Button onClick={save} loading={saving}>Save Changes</Button>
            </div>
          </Card>
        </>
      ) : null}
    </PageContainer>
  );
}
