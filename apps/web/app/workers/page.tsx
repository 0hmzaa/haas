"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/card";
import { PageContainer } from "../../components/page-container";
import { listWorkers } from "../../lib/api-client";
import type { WorkerProfile } from "../../lib/models";

export default function WorkersPage() {
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [skill, setSkill] = useState("");
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filters = useMemo(
    () => ({
      country: country.trim() || undefined,
      city: city.trim() || undefined,
      skill: skill.trim() || undefined
    }),
    [country, city, skill]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await listWorkers(filters);
        if (mounted) {
          setWorkers(response.items);
        }
      } catch (reason) {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : "Unable to load workers");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [filters]);

  return (
    <PageContainer
      title="Workers"
      subtitle="Find one verified human for one scoped real-world task."
      action={
        <Link
          href="/app/worker/onboarding"
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)]"
        >
          Become a Worker
        </Link>
      }
    >
      <Card className="grid gap-3 md:grid-cols-3">
        <input
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          placeholder="Country"
        />
        <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" />
        <input value={skill} onChange={(event) => setSkill(event.target.value)} placeholder="Skill" />
      </Card>

      {error ? (
        <Card>
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Loading workers...</p>
        </Card>
      ) : null}

      {!loading && workers.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">No workers found with current filters.</p>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {workers.map((worker) => (
          <Card key={worker.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text)]">
                  {worker.displayName}
                </h2>
                <p className="text-xs text-[var(--color-muted)]">
                  {[worker.city, worker.country].filter(Boolean).join(", ") || "Location not set"}
                </p>
              </div>
              <span className="rounded-full bg-stone-200 px-2 py-1 text-xs font-semibold text-stone-900">
                ⭐ {worker.ratingAvg.toFixed(1)}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--color-muted)]">
              {worker.bio || "No profile description yet."}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {worker.baseRate} HBAR / hour
              </p>
              <Link
                href={`/workers/${worker.id}`}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]"
              >
                View Profile
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
