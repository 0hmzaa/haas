"use client";

import { useState } from "react";
import { useSession } from "../lib/session-context";

export function NavWalletButton() {
  const { session, loading, connect, disconnect } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.walletAddress) {
    return (
      <button
        type="button"
        onClick={connect}
        disabled={loading}
        className="border-2 border-[var(--color-border-strong)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-[var(--color-primary-contrast)] shadow-[2px_2px_0_var(--color-border-strong)] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
      >
        {loading ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  const truncated = session.walletAddress.length > 12
    ? `${session.walletAddress.slice(0, 8)}...`
    : session.walletAddress;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-bold text-[var(--color-text)] shadow-[2px_2px_0_var(--color-border-strong)] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
      >
        <span className="inline-block h-2 w-2 bg-[var(--color-success)]" />
        {truncated}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] p-3 shadow-[4px_4px_0_var(--color-border-strong)]">
            <p className="text-xs text-[var(--color-muted)]">Wallet</p>
            <p className="mt-0.5 font-mono text-xs font-bold text-[var(--color-text)]">
              {session.walletAddress}
            </p>

            {session.workerId ? (
              <>
                <p className="mt-2 text-xs text-[var(--color-muted)]">Worker ID</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-[var(--color-text)]">
                  {session.workerId}
                </p>
              </>
            ) : null}

            {session.verifiedHumanId ? (
              <>
                <p className="mt-2 text-xs text-[var(--color-muted)]">Verified Human</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-[var(--color-text)] truncate">
                  {session.verifiedHumanId}
                </p>
              </>
            ) : null}

            <button
              type="button"
              onClick={async () => {
                await disconnect();
                setOpen(false);
              }}
              disabled={loading}
              className="mt-3 w-full border-2 border-[var(--color-danger)] px-3 py-1.5 text-xs font-bold text-[var(--color-danger)] transition hover:bg-[var(--color-danger)] hover:text-white"
            >
              Disconnect
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
