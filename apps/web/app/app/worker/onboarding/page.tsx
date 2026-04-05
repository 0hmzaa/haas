"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitErrorCodes,
  type IDKitResult
} from "@worldcoin/idkit";
import { Card } from "../../../../components/card";
import { PageContainer } from "../../../../components/page-container";
import { Stepper } from "../../../../components/stepper";
import { WalletSessionPanel } from "../../../../components/wallet-session-panel";
import { Button } from "../../../../components/button";
import {
  createWorker,
  getWorldRpSignature,
  verifyWorld
} from "../../../../lib/api-client";
import { useSession } from "../../../../lib/session-context";
import { saveSession } from "../../../../lib/session";
import type { WorldRpSignatureResponse } from "../../../../lib/models";

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
  const [verifyingIdentity, setVerifyingIdentity] = useState(false);
  const [worldRequest, setWorldRequest] = useState<WorldRpSignatureResponse | null>(null);
  const [worldWidgetOpen, setWorldWidgetOpen] = useState(false);

  const currentStep = useMemo(() => {
    if (session?.workerId) return 3;
    if (session?.verifiedHumanId) return 2;
    if (session?.walletAddress) return 1;
    return 0;
  }, [session]);

  const markIdentityVerified = (verifiedHumanId: string) => {
    if (!session?.walletAddress) {
      return;
    }

    saveSession({
      walletAddress: session.walletAddress,
      verifiedHumanId,
      workerId: session.workerId ?? null
    });
    refreshSession();
  };

  const verifyIdentityWithMock = async () => {
    if (!session?.walletAddress) {
      throw new Error("Connect a HashPack wallet first");
    }

    const verified = await verifyWorld({
      session_id: randomToken("session"),
      nullifier_hash: randomToken("nullifier"),
      walletAddress: session.walletAddress,
      proof: { valid: true }
    });

    markIdentityVerified(verified.verifiedHumanId);
    setMessage("Identity verified in mock mode.");
  };

  const beginWorldVerification = async () => {
    try {
      if (!session?.walletAddress) {
        throw new Error("Connect a HashPack wallet first");
      }

      setVerifyingIdentity(true);
      setError(null);
      setMessage(null);

      const requestContext = await getWorldRpSignature();
      setWorldRequest(requestContext);

      if (requestContext.mode === "mock") {
        await verifyIdentityWithMock();
        return;
      }

      setWorldWidgetOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "World verification failed");
    } finally {
      setVerifyingIdentity(false);
    }
  };

  const handleWorldVerification = async (result: IDKitResult) => {
    if (!session?.walletAddress) {
      throw new Error("Connect a HashPack wallet first");
    }

    const verified = await verifyWorld({
      walletAddress: session.walletAddress,
      result: result as unknown as Record<string, unknown>
    });

    markIdentityVerified(verified.verifiedHumanId);
    setMessage("World ID verification completed.");
  };

  const handleWorldError = (code: IDKitErrorCodes) => {
    setError(`World ID verification failed (${code})`);
  };

  const submit = async () => {
    try {
      if (!session?.walletAddress) {
        throw new Error("Connect a HashPack wallet first");
      }
      if (!displayName.trim()) {
        throw new Error("Display name is required");
      }
      if (!session.verifiedHumanId) {
        throw new Error("Complete World ID verification before creating your worker profile");
      }

      setLoading(true);
      setError(null);
      setMessage(null);

      const worker = await createWorker({
        verifiedHumanId: session.verifiedHumanId,
        displayName: displayName.trim(),
        bio: bio.trim(),
        country: country.trim(),
        city: city.trim(),
        timezone: timezone.trim(),
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        baseRate: baseRate.trim(),
        availabilityStatus: "AVAILABLE"
      });

      saveSession({
        walletAddress: session.walletAddress,
        verifiedHumanId: session.verifiedHumanId,
        workerId: worker.id
      });
      refreshSession();
      setMessage(`Worker profile created (${worker.id}).`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Worker onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  if (!session?.walletAddress) {
    return (
      <PageContainer
        title="Worker Onboarding"
        subtitle="Connect wallet, verify identity, and create your worker profile."
      >
        <WalletSessionPanel required />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Worker Onboarding"
      subtitle="Connect wallet, verify identity, and create your worker profile."
    >
      <Card variant="flat">
        <Stepper
          steps={["Connect Wallet", "Verify Identity", "Create Profile"]}
          currentStep={currentStep}
        />
      </Card>

      {/* Step 1: Identity (auto-verified on submit) */}
      {currentStep === 1 ? (
        <Card>
          <h2 className="text-base font-bold">World ID Verification</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Verify your identity with World ID before creating your worker profile.
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Wallet connected: <span className="font-mono font-bold text-[var(--color-text)]">{session?.walletAddress}</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={beginWorldVerification} loading={verifyingIdentity}>
              Verify with World ID
            </Button>
            {error ? <p className="text-xs font-semibold text-[var(--color-danger)]">{error}</p> : null}
          </div>
          {message ? (
            <p className="mt-2 text-xs font-semibold text-[var(--color-success)]">
              {message}
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Step 1-2: Profile form */}
      {currentStep >= 2 && currentStep < 3 ? (
        <Card>
          <h2 className="text-base font-bold">Profile Setup</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-[var(--color-muted)]">Display Name *</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="John Doe"
                className="mt-1 w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-muted)]">Hourly Rate (HBAR)</label>
              <input
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                placeholder="10.00"
                className="mt-1 w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-muted)]">Country</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="France"
                className="mt-1 w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-muted)]">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Cannes"
                className="mt-1 w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-muted)]">Timezone</label>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/Paris"
                className="mt-1 w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-muted)]">Skills (comma-separated)</label>
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="delivery, verification, photography"
                className="mt-1 w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-[var(--color-muted)]">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell clients about yourself and your experience..."
                className="mt-1 min-h-28 w-full"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={submit} loading={loading}>
              Create Worker Profile
            </Button>
            {error ? <p className="text-xs font-semibold text-[var(--color-danger)]">{error}</p> : null}
          </div>
        </Card>
      ) : null}

      {worldRequest?.mode === "live" ? (
        <IDKitRequestWidget
          open={worldWidgetOpen}
          onOpenChange={setWorldWidgetOpen}
          app_id={worldRequest.appId as `app_${string}`}
          action={worldRequest.action}
          allow_legacy_proofs={worldRequest.allowLegacyProofs}
          rp_context={worldRequest.rpContext}
          preset={orbLegacy({ signal: session.walletAddress })}
          autoClose
          handleVerify={handleWorldVerification}
          onSuccess={() => {
            setWorldWidgetOpen(false);
          }}
          onError={handleWorldError}
        />
      ) : null}

      {/* Step 3: Success */}
      {currentStep === 3 ? (
        <Card>
          <h2 className="text-base font-bold text-[var(--color-success)]">
            Profile Created Successfully
          </h2>
          {message ? <p className="mt-1 text-sm text-[var(--color-muted)]">{message}</p> : null}
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Worker ID: <span className="font-mono font-bold text-[var(--color-text)]">{session?.workerId}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/app/worker/profile"
              className="border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-sm font-bold shadow-[3px_3px_0_var(--color-border-strong)]"
            >
              View Profile
            </Link>
            <Link
              href="/app/worker/tasks"
              className="border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-sm font-bold shadow-[3px_3px_0_var(--color-border-strong)]"
            >
              Browse Tasks
            </Link>
          </div>
        </Card>
      ) : null}
    </PageContainer>
  );
}
