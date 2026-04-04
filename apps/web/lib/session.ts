"use client";

const STORAGE_KEY = "haas-web-session";

export type HaasSession = {
  walletAddress: string;
  verifiedHumanId: string | null;
  workerId: string | null;
  clientId: string;
};

export function isHederaAccountId(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

export function getSession(): HaasSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as HaasSession;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: HaasSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export async function connectHashPackMvp(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Wallet connection is only available in browser");
  }

  const accountId = window.prompt(
    "Enter your HashPack Hedera account ID (format 0.0.x)"
  );

  if (!accountId || !isHederaAccountId(accountId.trim())) {
    throw new Error("Invalid Hedera account id");
  }

  return accountId.trim();
}
