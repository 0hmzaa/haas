"use client";

const STORAGE_KEY = "haas-web-session";
const DEFAULT_PAIRING_TIMEOUT_MS = 60_000;

type HashConnectRuntime = {
  hashconnect: {
    init: () => Promise<void>;
    disconnect: () => Promise<void>;
    openPairingModal: (
      themeMode?: "dark" | "light",
      backgroundColor?: string,
      accentColor?: string,
      accentFillColor?: string,
      borderRadius?: string
    ) => Promise<void>;
    connectedAccountIds: Array<{ toString(): string }>;
    pairingEvent: {
      on: (listener: (data: { accountIds: string[] }) => void) => unknown;
    };
  };
};

let hashConnectRuntimePromise: Promise<HashConnectRuntime> | null = null;

export type HaasSession = {
  walletAddress: string;
  verifiedHumanId: string | null;
  workerId: string | null;
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
    return JSON.parse(raw) as HaasSession;
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

export function deriveClientNamespace(walletAddress: string): string {
  return `client:${walletAddress.replace(/\./g, "_")}`;
}

async function createHashConnectRuntime(): Promise<HashConnectRuntime> {
  if (typeof window === "undefined") {
    throw new Error("Wallet connection is only available in browser");
  }

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in environment"
    );
  }

  const [{ HashConnect }, { LedgerId }] = await Promise.all([
    import("hashconnect"),
    import("@hashgraph/sdk")
  ]);

  const network = (process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "testnet").toLowerCase();
  const ledgerId =
    network === "mainnet"
      ? LedgerId.MAINNET
      : network === "previewnet"
        ? LedgerId.PREVIEWNET
        : LedgerId.TESTNET;

  const metadata = {
    name: "HumanAsAService",
    description: "Verified human execution layer for AI systems",
    icons: [`${window.location.origin}/favicon.ico`],
    url: window.location.origin
  };

  const hashconnect = new HashConnect(ledgerId, projectId, metadata, false);
  await hashconnect.init();

  return { hashconnect };
}

async function getHashConnectRuntime(): Promise<HashConnectRuntime> {
  if (!hashConnectRuntimePromise) {
    hashConnectRuntimePromise = createHashConnectRuntime();
  }

  return hashConnectRuntimePromise;
}

function getFirstConnectedAccount(runtime: HashConnectRuntime): string | null {
  const account = runtime.hashconnect.connectedAccountIds[0];
  if (!account) {
    return null;
  }

  const value = account.toString();
  return isHederaAccountId(value) ? value : null;
}

async function waitForPairingAccount(runtime: HashConnectRuntime): Promise<string> {
  const connected = getFirstConnectedAccount(runtime);
  if (connected) {
    return connected;
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("HashPack pairing timed out"));
    }, DEFAULT_PAIRING_TIMEOUT_MS);

    runtime.hashconnect.pairingEvent.on((pairingData) => {
      const accountId = pairingData.accountIds.find((item) => isHederaAccountId(item));
      if (!accountId) {
        return;
      }

      window.clearTimeout(timer);
      resolve(accountId);
    });
  });
}

export async function connectHashPack(): Promise<string> {
  const runtime = await getHashConnectRuntime();

  const existing = getFirstConnectedAccount(runtime);
  if (existing) {
    return existing;
  }

  await runtime.hashconnect.openPairingModal(
    "light",
    "#fffdf8",
    "#2f221a",
    "#f7f3ec",
    "14px"
  );

  const pairedAccountId = await waitForPairingAccount(runtime);
  if (!isHederaAccountId(pairedAccountId)) {
    throw new Error("Invalid Hedera account returned by wallet");
  }

  return pairedAccountId;
}

export async function disconnectHashPack(): Promise<void> {
  try {
    if (!hashConnectRuntimePromise) {
      return;
    }

    const runtime = await hashConnectRuntimePromise;
    await runtime.hashconnect.disconnect();
  } catch {
    // swallow disconnect errors for local UX stability
  } finally {
    hashConnectRuntimePromise = null;
  }
}
