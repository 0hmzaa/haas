export type HederaConfig = {
  enabled: boolean;
  network: "testnet" | "mainnet";
  operatorAccountId?: string;
  operatorPrivateKey?: string;
  operatorPrivateKeyType: "auto" | "ecdsa" | "ed25519";
  hcsTopicId?: string;
  scheduleAdminKey?: string;
  scheduleAdminKeyType: "auto" | "ecdsa" | "ed25519";
  mirrorNodeBaseUrl: string;
  defaultEscrowAccountId?: string;
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function getMirrorNodeBaseUrl(network: "testnet" | "mainnet"): string {
  const configured = process.env.HEDERA_MIRROR_NODE_BASE_URL;
  if (isNonEmpty(configured)) {
    return configured;
  }

  if (network === "mainnet") {
    return "https://mainnet-public.mirrornode.hedera.com";
  }

  return "https://testnet.mirrornode.hedera.com";
}

function parsePrivateKeyType(
  value: string | undefined,
  fallback: "auto" | "ecdsa" | "ed25519" = "auto"
): "auto" | "ecdsa" | "ed25519" {
  if (!value || value.length === 0) {
    return fallback;
  }

  const normalized = value.toLowerCase();
  if (normalized === "ecdsa" || normalized === "ed25519" || normalized === "auto") {
    return normalized;
  }

  return fallback;
}

export function getHederaConfig(): HederaConfig {
  const network = process.env.HEDERA_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const enabled = process.env.HEDERA_ENABLED === "true";
  const operatorPrivateKeyType = parsePrivateKeyType(
    process.env.HEDERA_OPERATOR_PRIVATE_KEY_TYPE
  );
  const scheduleAdminKeyType = parsePrivateKeyType(
    process.env.HEDERA_SCHEDULE_ADMIN_KEY_TYPE,
    operatorPrivateKeyType
  );

  return {
    enabled,
    network,
    operatorAccountId: process.env.HEDERA_OPERATOR_ACCOUNT_ID,
    operatorPrivateKey: process.env.HEDERA_OPERATOR_PRIVATE_KEY,
    operatorPrivateKeyType,
    hcsTopicId: process.env.HEDERA_HCS_TOPIC_ID,
    scheduleAdminKey: process.env.HEDERA_SCHEDULE_ADMIN_KEY,
    scheduleAdminKeyType,
    mirrorNodeBaseUrl: getMirrorNodeBaseUrl(network),
    defaultEscrowAccountId: process.env.HEDERA_ESCROW_ACCOUNT_ID
  };
}
