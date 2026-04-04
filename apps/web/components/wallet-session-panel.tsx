"use client";

import { useEffect, useState } from "react";
import { getIdentityByWallet } from "../lib/api-client";
import {
  clearSession,
  connectHashPack,
  deriveClientNamespace,
  disconnectHashPack,
  getSession,
  saveSession,
  type HaasSession
} from "../lib/session";

type WalletSessionPanelProps = {
  onSessionChange?: (session: HaasSession | null) => void;
  required?: boolean;
};

export function WalletSessionPanel({
  onSessionChange,
  required = false
}: WalletSessionPanelProps) {
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

      const walletAddress = await connectHashPack();
      const identity = await getIdentityByWallet(walletAddress).catch(() => null);

      const nextSession: HaasSession = {
        walletAddress,
        verifiedHumanId: identity?.verifiedHumanId ?? null,
        workerId: identity?.worker?.id ?? null
      };

      saveSession(nextSession);
      setSession(nextSession);
      onSessionChange?.(nextSession);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to connect HashPack");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    setError(null);

    await disconnectHashPack();
    clearSession();
    setSession(null);
    onSessionChange?.(null);
    setLoading(false);
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Wallet</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Connect HashPack to unlock private worker/client workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session?.walletAddress ? (
            <button
              type="button"
              onClick={disconnect}
              disabled={loading}
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              Disconnect
            </button>
          ) : null}
          <button
            type="button"
            onClick={connect}
            disabled={loading}
            className="rounded-xl bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-contrast)] disabled:opacity-60"
          >
            {loading ? "Connecting..." : session?.walletAddress ? "Reconnect" : "Connect HashPack"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p> : null}

      <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)] md:grid-cols-2">
        <p>
          Wallet: <span className="font-semibold text-[var(--color-text)]">{session?.walletAddress || "Not connected"}</span>
        </p>
        <p>
          Worker profile: <span className="font-semibold text-[var(--color-text)]">{session?.workerId || "Not linked"}</span>
        </p>
      </div>

      {session?.walletAddress ? (
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Client namespace (derived): <span className="font-semibold text-[var(--color-text)]">{deriveClientNamespace(session.walletAddress)}</span>
        </p>
      ) : null}

      {required && !session?.walletAddress ? (
        <p className="mt-3 text-xs text-[var(--color-warning)]">
          Wallet connection is required to access this workflow.
        </p>
      ) : null}
    </section>
  );
}
