import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../lib/app-error.js";
import { getX402Config } from "../../config/x402.config.js";
import type { FundingWebhookInput } from "./payments.service.js";

export type VerifyFundingWebhookSignatureInput = {
  webhook: FundingWebhookInput;
  signature?: string;
  timestamp?: string;
  facilitatorId?: string;
};

export type VerifyFundingWebhookSignatureResult = {
  facilitatorId?: string;
  signatureVerified: boolean;
};

function normalizeSignature(value: string): string {
  return value.startsWith("v1=") ? value.slice(3) : value;
}

function isHexString(value: string): boolean {
  return /^[a-f0-9]+$/i.test(value);
}

function safeHexEqual(left: string, right: string): boolean {
  if (!isHexString(left) || !isHexString(right) || left.length !== right.length) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length || leftBuffer.length === 0) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseUnixTimestampSeconds(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError("Invalid x402 timestamp header", 400);
  }

  return Math.floor(parsed);
}

function buildCanonicalPayload(input: {
  timestamp: number;
  facilitatorId: string;
  webhook: FundingWebhookInput;
}): string {
  const fields = [
    input.webhook.x402PaymentId ?? "",
    input.webhook.orderId ?? "",
    input.webhook.success ? "true" : "false",
    input.webhook.hederaTxId ?? "",
    input.facilitatorId,
    input.webhook.payerAccount ?? "",
    input.webhook.amount ?? "",
    input.webhook.asset ?? ""
  ];

  return `${input.timestamp}.${fields.join("|")}`;
}

export class X402FacilitatorVerifierService {
  private readonly config = getX402Config();

  verifyFundingWebhookSignature(
    input: VerifyFundingWebhookSignatureInput
  ): VerifyFundingWebhookSignatureResult {
    const presentedFacilitatorId = input.facilitatorId ?? input.webhook.facilitatorId;
    const resolvedFacilitatorId = this.config.facilitatorId ?? presentedFacilitatorId;

    if (!this.config.requireSignedWebhook) {
      return {
        facilitatorId: resolvedFacilitatorId,
        signatureVerified: false
      };
    }

    if (!this.config.signingSecret) {
      throw new AppError("X402_FACILITATOR_SIGNING_SECRET is required", 500);
    }

    if (!resolvedFacilitatorId) {
      throw new AppError("facilitatorId is required for signed x402 webhook", 401);
    }

    if (
      this.config.facilitatorId &&
      presentedFacilitatorId &&
      presentedFacilitatorId !== this.config.facilitatorId
    ) {
      throw new AppError("Invalid facilitatorId", 401);
    }

    if (!input.timestamp || input.timestamp.length === 0) {
      throw new AppError("x-x402-timestamp header is required", 401);
    }

    if (!input.signature || input.signature.length === 0) {
      throw new AppError("x-x402-signature header is required", 401);
    }

    const timestamp = parseUnixTimestampSeconds(input.timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (Math.abs(nowSeconds - timestamp) > this.config.signatureMaxAgeSeconds) {
      throw new AppError("x402 signature timestamp is expired", 401);
    }

    const canonical = buildCanonicalPayload({
      timestamp,
      facilitatorId: resolvedFacilitatorId,
      webhook: input.webhook
    });

    const expectedSignature = createHmac("sha256", this.config.signingSecret)
      .update(canonical)
      .digest("hex");
    const normalizedProvidedSignature = normalizeSignature(input.signature).toLowerCase();

    if (!safeHexEqual(expectedSignature, normalizedProvidedSignature)) {
      throw new AppError("Invalid x402 webhook signature", 401);
    }

    return {
      facilitatorId: resolvedFacilitatorId,
      signatureVerified: true
    };
  }
}
