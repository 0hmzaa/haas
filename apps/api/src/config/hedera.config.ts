export type HederaConfig = {
  enabled: boolean;
  network: "testnet" | "mainnet";
  operatorAccountId?: string;
  operatorPrivateKey?: string;
  hcsTopicId?: string;
  scheduleAdminKey?: string;
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

export function getHederaConfig(): HederaConfig {
  const network = process.env.HEDERA_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const enabled = process.env.HEDERA_ENABLED === "true";

  return {
    enabled,
    network,
    operatorAccountId: process.env.HEDERA_OPERATOR_ACCOUNT_ID,
    operatorPrivateKey: process.env.HEDERA_OPERATOR_PRIVATE_KEY,
    hcsTopicId: process.env.HEDERA_HCS_TOPIC_ID,
    scheduleAdminKey: process.env.HEDERA_SCHEDULE_ADMIN_KEY,
    mirrorNodeBaseUrl: getMirrorNodeBaseUrl(network),
    defaultEscrowAccountId: process.env.HEDERA_ESCROW_ACCOUNT_ID
  };
}
