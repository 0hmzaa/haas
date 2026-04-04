"use client";

import { useState } from "react";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { WalletSessionPanel } from "../../../../components/wallet-session-panel";
import { createWorker, verifyWorld } from "../../../../lib/api-client";
import { useSession } from "../../../../lib/session-context";
import { saveSession } from "../../../../lib/session";

function randomToken(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

export default function WorkerOnboardingPage() {
  const { session, refresh: refreshSession } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [skills, setSkills] = useState("delivery, verification");
  const [baseRate, setBaseRate] = useState("10.00");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      if (!session?.walletAddress) {
        throw new Error("Connect a HashPack wallet first");
      }

      if (!displayName.trim()) {
        throw new Error("Display name is required");
      }

      setLoading(true);
      setError(null);
      setMessage(null);

      const verifiedHumanId =
        session.verifiedHumanId ??
        (
          await verifyWorld({
            session_id: randomToken("session"),
            nullifier_hash: randomToken("nullifier"),
            walletAddress: session.walletAddress,
            proof: { valid: true }
          })
        ).verifiedHumanId;

      const worker = await createWorker({
        verifiedHumanId,
        displayName: displayName.trim(),
        bio: bio.trim(),
        country: country.trim(),
        city: city.trim(),
        timezone: timezone.trim(),
        skills: skills
          .split(",")
          .map((skill) => skill.trim())
          .filter((skill) => skill.length > 0),
        baseRate: baseRate.trim(),
        availabilityStatus: "AVAILABLE",
        acceptedProofTypes: ["photo", "text"]
      });

      saveSession({
        walletAddress: session.walletAddress,
        verifiedHumanId,
        workerId: worker.id
      });
      refreshSession();
      setMessage(
        `Worker profile created (${worker.id}). World verification state is currently handled in pending-friendly MVP mode.`
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Worker onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      title="Worker Onboarding"
      subtitle="Connect wallet, create worker profile, and become bookable."
    >
      <WalletSessionPanel required />

      <Card>
        <h2 className="text-base font-semibold">Profile Setup</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          World verification can be enforced later. For now, the flow remains pending-friendly.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
          />
          <input
            value={baseRate}
            onChange={(event) => setBaseRate(event.target.value)}
            placeholder="Hourly rate in HBAR"
          />
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="Country"
          />
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" />
          <input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            placeholder="Timezone"
          />
          <input
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
            placeholder="Skills (comma separated)"
            className="md:col-span-2"
          />
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Description"
            className="min-h-28 md:col-span-2"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-contrast)] disabled:opacity-60"
          >
            {loading ? "Saving..." : "Create Worker Profile"}
          </button>
          {message ? <p className="text-xs text-[var(--color-success)]">{message}</p> : null}
          {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
        </div>
      </Card>
    </PageContainer>
  );
}
