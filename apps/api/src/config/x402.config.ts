import { getHederaConfig } from "./hedera.config.js";

export type X402Config = {
  requireSignedWebhook: boolean;
  facilitatorId?: string;
  signingSecret?: string;
  signatureMaxAgeSeconds: number;
  verifyHederaTx: boolean;
  mirrorNodeBaseUrl: string;
  facilitatorMode: "legacy" | "verify-settle";
  facilitatorApiBaseUrl?: string;
  facilitatorVerifyPath: string;
  facilitatorSettlePath: string;
  facilitatorFundingPath: string;
  facilitatorApiKey?: string;
  facilitatorApiKeyHeader: string;
  facilitatorTimeoutMs: number;
  paymentNetwork: string;
  paymentResourceBaseUrl: string;
  paymentDescription: string;
  paymentMimeType: string;
  paymentMaxTimeoutSeconds: number;
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function getX402Config(): X402Config {
  const hederaConfig = getHederaConfig();
  const maxAgeFromEnv = Number(process.env.X402_SIGNATURE_MAX_AGE_SECONDS ?? "300");
  const timeoutMsFromEnv = Number(process.env.X402_FACILITATOR_TIMEOUT_MS ?? "10000");
  const paymentMaxTimeoutSecondsFromEnv = Number(
    process.env.X402_PAYMENT_MAX_TIMEOUT_SECONDS ?? "300"
  );
  const modeFromEnv = process.env.X402_FACILITATOR_MODE?.toLowerCase();
  const mirrorNodeBaseUrl =
    isNonEmpty(process.env.X402_MIRROR_NODE_BASE_URL)
      ? process.env.X402_MIRROR_NODE_BASE_URL
      : hederaConfig.mirrorNodeBaseUrl;

  return {
    requireSignedWebhook: process.env.X402_REQUIRE_SIGNED_WEBHOOK !== "false",
    facilitatorId: isNonEmpty(process.env.X402_FACILITATOR_ID)
      ? process.env.X402_FACILITATOR_ID
      : undefined,
    signingSecret: isNonEmpty(process.env.X402_FACILITATOR_SIGNING_SECRET)
      ? process.env.X402_FACILITATOR_SIGNING_SECRET
      : undefined,
    signatureMaxAgeSeconds:
      Number.isFinite(maxAgeFromEnv) && maxAgeFromEnv > 0 ? maxAgeFromEnv : 300,
    verifyHederaTx: process.env.X402_VERIFY_HEDERA_TX === "true",
    mirrorNodeBaseUrl,
    facilitatorMode: modeFromEnv === "legacy" ? "legacy" : "verify-settle",
    facilitatorApiBaseUrl: isNonEmpty(process.env.X402_FACILITATOR_API_BASE_URL)
      ? process.env.X402_FACILITATOR_API_BASE_URL
      : undefined,
    facilitatorVerifyPath: isNonEmpty(process.env.X402_FACILITATOR_VERIFY_PATH)
      ? process.env.X402_FACILITATOR_VERIFY_PATH
      : "/verify",
    facilitatorSettlePath: isNonEmpty(process.env.X402_FACILITATOR_SETTLE_PATH)
      ? process.env.X402_FACILITATOR_SETTLE_PATH
      : "/settle",
    facilitatorFundingPath: isNonEmpty(process.env.X402_FACILITATOR_FUNDING_PATH)
      ? process.env.X402_FACILITATOR_FUNDING_PATH
      : "/v1/facilitator/payments/hedera/fund",
    facilitatorApiKey: isNonEmpty(process.env.X402_FACILITATOR_API_KEY)
      ? process.env.X402_FACILITATOR_API_KEY
      : undefined,
    facilitatorApiKeyHeader: isNonEmpty(process.env.X402_FACILITATOR_API_KEY_HEADER)
      ? process.env.X402_FACILITATOR_API_KEY_HEADER
      : "x-api-key",
    facilitatorTimeoutMs:
      Number.isFinite(timeoutMsFromEnv) && timeoutMsFromEnv > 0 ? timeoutMsFromEnv : 10_000,
    paymentNetwork:
      isNonEmpty(process.env.X402_PAYMENT_NETWORK)
        ? process.env.X402_PAYMENT_NETWORK
        : hederaConfig.network === "mainnet"
          ? "hedera-mainnet"
          : "hedera-testnet",
    paymentResourceBaseUrl: isNonEmpty(process.env.X402_PAYMENT_RESOURCE_BASE_URL)
      ? process.env.X402_PAYMENT_RESOURCE_BASE_URL
      : "http://localhost:4000",
    paymentDescription: isNonEmpty(process.env.X402_PAYMENT_DESCRIPTION)
      ? process.env.X402_PAYMENT_DESCRIPTION
      : "HumanAsAService order funding",
    paymentMimeType: isNonEmpty(process.env.X402_PAYMENT_MIME_TYPE)
      ? process.env.X402_PAYMENT_MIME_TYPE
      : "application/json",
    paymentMaxTimeoutSeconds:
      Number.isFinite(paymentMaxTimeoutSecondsFromEnv) &&
      paymentMaxTimeoutSecondsFromEnv > 0
        ? paymentMaxTimeoutSecondsFromEnv
        : 300
  };
}
