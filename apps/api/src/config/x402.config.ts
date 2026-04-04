import { getHederaConfig } from "./hedera.config.js";

export type X402Config = {
  requireSignedWebhook: boolean;
  facilitatorId?: string;
  signingSecret?: string;
  signatureMaxAgeSeconds: number;
  verifyHederaTx: boolean;
  mirrorNodeBaseUrl: string;
  facilitatorApiBaseUrl?: string;
  facilitatorFundingPath: string;
  facilitatorApiKey?: string;
  facilitatorTimeoutMs: number;
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function getX402Config(): X402Config {
  const hederaConfig = getHederaConfig();
  const maxAgeFromEnv = Number(process.env.X402_SIGNATURE_MAX_AGE_SECONDS ?? "300");
  const timeoutMsFromEnv = Number(process.env.X402_FACILITATOR_TIMEOUT_MS ?? "10000");
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
    facilitatorApiBaseUrl: isNonEmpty(process.env.X402_FACILITATOR_API_BASE_URL)
      ? process.env.X402_FACILITATOR_API_BASE_URL
      : undefined,
    facilitatorFundingPath: isNonEmpty(process.env.X402_FACILITATOR_FUNDING_PATH)
      ? process.env.X402_FACILITATOR_FUNDING_PATH
      : "/v1/facilitator/payments/hedera/fund",
    facilitatorApiKey: isNonEmpty(process.env.X402_FACILITATOR_API_KEY)
      ? process.env.X402_FACILITATOR_API_KEY
      : undefined,
    facilitatorTimeoutMs:
      Number.isFinite(timeoutMsFromEnv) && timeoutMsFromEnv > 0 ? timeoutMsFromEnv : 10_000
  };
}
