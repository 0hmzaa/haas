"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { PageContainer } from "../../components/page-container";
import { SkeletonCard } from "../../components/skeleton";
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
      skill: skill.trim() || undefined,
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
        if (mounted) setWorkers(response.items);
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Unable to load workers");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [filters]);

  return (
    <PageContainer
      title="Workers"
      subtitle="Find one verified human for one scoped real-world task."
      action={
        <Link href="/app/worker/onboarding">
          <Button size="sm">Become a Worker</Button>
        </Link>
      }
    >
      <Card variant="flat">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">Country</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="France" className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cannes" className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--color-muted)]">Skill</label>
            <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="delivery" className="mt-1 w-full" />
          </div>
        </div>
      </Card>

      {error ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-danger)]">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!loading && workers.length === 0 ? (
        <Card variant="flat">
          <p className="text-sm font-semibold text-[var(--color-muted)]">No workers found with current filters.</p>
        </Card>
      ) : null}

      {!loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {workers.map((worker) => (
            <Card key={worker.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">{worker.displayName}</h2>
                  <p className="text-xs text-[var(--color-muted)]">
                    {[worker.city, worker.country].filter(Boolean).join(", ") || "Location not set"}
                  </p>
                </div>
                <span className="border-2 border-[var(--color-border-strong)] px-2 py-0.5 text-xs font-black">
                  {(worker.ratingAvg ?? 0).toFixed(1)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-[var(--color-muted)]">
                {worker.bio || "No profile description yet."}
              </p>
              {Array.isArray(worker.skills) && worker.skills.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(worker.skills as string[]).slice(0, 4).map((s) => (
                    <Badge key={s} variant="outline">{s}</Badge>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm font-bold">{worker.baseRate} HBAR / hour</p>
                <Link
                  href={`/workers/${worker.id}`}
                  className="border-2 border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_var(--color-border-strong)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  View Profile
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </PageContainer>
  );
}
