"use client";

import { useEffect, useState } from "react";
import { connectHashPackMvp, getSession, saveSession, type HaasSession } from "../lib/session";
import { getIdentityByWallet } from "../lib/api-client";

type WalletSessionPanelProps = {
  onSessionChange?: (session: HaasSession | null) => void;
};

export function WalletSessionPanel({ onSessionChange }: WalletSessionPanelProps) {
  const [session, setSession] = useState<HaasSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getSession();
    setSession(cached);
    onSessionChange?.(cached);
  }, [onSessionChange]);

  const connect = async () => {
    try {
      setLoading(true);
      setError(null);
      const walletAddress = await connectHashPackMvp();

      const identity = await getIdentityByWallet(walletAddress).catch(() => null);
      const nextSession: HaasSession = {
        walletAddress,
        verifiedHumanId: identity?.verifiedHumanId ?? null,
        workerId: identity?.worker?.id ?? null,
        clientId: getSession()?.clientId ?? "client-live"
      };

      saveSession(nextSession);
      setSession(nextSession);
      onSessionChange?.(nextSession);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  const updateClientId = (value: string) => {
    const current = session ?? {
      walletAddress: "",
      verifiedHumanId: null,
      workerId: null,
      clientId: "client-live"
    };
    const next = {
      ...current,
      clientId: value
    };
    saveSession(next);
    setSession(next);
    onSessionChange?.(next);
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Wallet Session</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            HashPack-assisted account connection for MVP workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={connect}
          disabled={loading}
          className="rounded-xl bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-contrast)] disabled:opacity-60"
        >
          {loading ? "Connecting..." : "Connect HashPack"}
        </button>
      </div>

      {error ? <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p> : null}

      <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)] md:grid-cols-2">
        <p>
          Wallet:{" "}
          <span className="font-semibold text-[var(--color-text)]">
            {session?.walletAddress || "Not connected"}
          </span>
        </p>
        <p>
          Worker:{" "}
          <span className="font-semibold text-[var(--color-text)]">
            {session?.workerId || "Not linked"}
          </span>
        </p>
      </div>

      <label className="mt-3 block text-xs font-semibold text-[var(--color-muted)]">
        Client ID (agent/operator namespace)
      </label>
      <input
        value={session?.clientId ?? "client-live"}
        onChange={(event) => updateClientId(event.target.value)}
        placeholder="client-live"
      />
    </section>
  );
}
