"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getIdentityByWallet } from "./api-client";
import {
  clearSession,
  connectHashPack,
  disconnectHashPack,
  getSession,
  saveSession,
  type HaasSession,
} from "./session";

type SessionContextValue = {
  session: HaasSession | null;
  loading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<HaasSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const refresh = useCallback(() => {
    setSession(getSession());
  }, []);

  const connect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const walletAddress = await connectHashPack();
      const identity = await getIdentityByWallet(walletAddress).catch(
        () => null
      );

      const next: HaasSession = {
        walletAddress,
        verifiedHumanId: identity?.verifiedHumanId ?? null,
        workerId: identity?.worker?.id ?? null,
      };

      saveSession(next);
      setSession(next);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to connect wallet"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    await disconnectHashPack();
    clearSession();
    setSession(null);
    setLoading(false);
  }, []);

  return (
    <SessionContext
      value={{ session, loading, error, connect, disconnect, refresh }}
    >
      {children}
    </SessionContext>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
