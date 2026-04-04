"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { WalletSessionPanel } from "../../../../components/wallet-session-panel";
import { getWorkerById, updateWorker } from "../../../../lib/api-client";
import type { WorkerProfile } from "../../../../lib/models";
import type { HaasSession } from "../../../../lib/session";

export default function WorkerProfilePage() {
  const [session, setSession] = useState<HaasSession | null>(null);
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
      if (!worker) {
        throw new Error("No worker profile loaded");
      }

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
        availabilityStatus: worker.availabilityStatus
      });
      setWorker(updated);
      setMessage("Profile updated");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer title="Worker Profile" subtitle="Manage profile and availability.">
      <WalletSessionPanel onSessionChange={setSession} required />

      {!session?.workerId ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            No worker linked to this wallet yet. Complete onboarding first.
          </p>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading profile...</p>
        </Card>
      ) : null}

      {worker ? (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={worker.displayName}
              onChange={(event) => setWorker({ ...worker, displayName: event.target.value })}
              placeholder="Display name"
            />
            <input
              value={worker.baseRate}
              onChange={(event) => setWorker({ ...worker, baseRate: event.target.value })}
              placeholder="Base rate in HBAR"
            />
            <input
              value={worker.country ?? ""}
              onChange={(event) => setWorker({ ...worker, country: event.target.value })}
              placeholder="Country"
            />
            <input
              value={worker.city ?? ""}
              onChange={(event) => setWorker({ ...worker, city: event.target.value })}
              placeholder="City"
            />
            <input
              value={worker.timezone ?? ""}
              onChange={(event) => setWorker({ ...worker, timezone: event.target.value })}
              placeholder="Timezone"
            />
            <input
              value={worker.availabilityStatus}
              onChange={(event) =>
                setWorker({ ...worker, availabilityStatus: event.target.value })
              }
              placeholder="Availability status"
            />
            <textarea
              value={worker.bio ?? ""}
              onChange={(event) => setWorker({ ...worker, bio: event.target.value })}
              placeholder="Description"
              className="min-h-28 md:col-span-2"
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {message ? <p className="text-xs text-[var(--color-success)]">{message}</p> : null}
            {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
          </div>
        </Card>
      ) : null}
    </PageContainer>
  );
}
