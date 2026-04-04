"use client";

import { useSession } from "../lib/session-context";
import { deriveClientNamespace } from "../lib/session";

type WalletSessionPanelProps = {
  required?: boolean;
};

export function WalletSessionPanel({ required = false }: WalletSessionPanelProps) {
  const { session, loading, error, connect } = useSession();

  return (
    <section className="border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[4px_4px_0_var(--color-border-strong)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[var(--color-text)]">Wallet</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            HashPack wallet connection for worker/client workflows.
          </p>
        </div>
        {!session?.walletAddress ? (
          <button
            type="button"
            onClick={connect}
            disabled={loading}
            className="border-2 border-[var(--color-border-strong)] bg-[var(--color-primary)] px-3 py-2 text-xs font-bold text-[var(--color-primary-contrast)] shadow-[2px_2px_0_var(--color-border-strong)] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect HashPack"}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs font-semibold text-[var(--color-danger)]">{error}</p> : null}

      <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)] md:grid-cols-2">
        <p>
          Wallet:{" "}
          <span className="font-mono font-bold text-[var(--color-text)]">
            {session?.walletAddress || "Not connected"}
          </span>
        </p>
        <p>
          Worker:{" "}
          <span className="font-mono font-bold text-[var(--color-text)]">
            {session?.workerId || "Not linked"}
          </span>
        </p>
      </div>

      {session?.walletAddress ? (
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Client namespace:{" "}
          <span className="font-mono font-bold text-[var(--color-text)]">
            {deriveClientNamespace(session.walletAddress)}
          </span>
        </p>
      ) : null}

      {required && !session?.walletAddress ? (
        <p className="mt-3 text-xs font-semibold text-[var(--color-warning)]">
          Wallet connection required. Use the button above or the navbar wallet button.
        </p>
      ) : null}
    </section>
  );
}
