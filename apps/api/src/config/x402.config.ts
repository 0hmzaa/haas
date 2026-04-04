import { getHederaConfig } from "./hedera.config.js";

export type X402Config = {
  requireSignedWebhook: boolean;
  facilitatorId?: string;
  signingSecret?: string;
  signatureMaxAgeSeconds: number;
  verifyHederaTx: boolean;
  mirrorNodeBaseUrl: string;
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function getX402Config(): X402Config {
  const hederaConfig = getHederaConfig();
  const maxAgeFromEnv = Number(process.env.X402_SIGNATURE_MAX_AGE_SECONDS ?? "300");
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
    mirrorNodeBaseUrl
  };
}
