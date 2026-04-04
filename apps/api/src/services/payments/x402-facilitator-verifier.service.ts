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
  hederaTxVerified: boolean;
};

type MirrorTransactionRecord = {
  transaction_id: string;
  result: string;
  name?: string;
};

type MirrorTransactionsResponse = {
  transactions?: MirrorTransactionRecord[];
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

  private async verifyHederaTransaction(hederaTxId: string): Promise<void> {
    if (!this.config.verifyHederaTx) {
      return;
    }

    const fetchFn = globalThis.fetch;
    if (typeof fetchFn !== "function") {
      throw new AppError("Global fetch is not available for Hedera tx verification", 500);
    }

    const baseUrl = this.config.mirrorNodeBaseUrl.replace(/\/+$/, "");
    const response = await fetchFn(
      `${baseUrl}/api/v1/transactions/${encodeURIComponent(hederaTxId)}`,
      {
        headers: {
          accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new AppError("Unable to verify Hedera transaction from Mirror Node", 502);
    }

    const payload = (await response.json()) as MirrorTransactionsResponse;
    const transactions = payload.transactions ?? [];
    const successTx = transactions.find((tx) => tx.result === "SUCCESS");

    if (!successTx) {
      throw new AppError("Hedera transaction is not confirmed as SUCCESS", 409);
    }

    if (typeof successTx.name === "string" && !successTx.name.includes("CRYPTO")) {
      throw new AppError("Hedera funding transaction is not a crypto transfer", 409);
    }
  }

  async verifyFundingTransactionIfEnabled(hederaTxId: string): Promise<boolean> {
    await this.verifyHederaTransaction(hederaTxId);
    return this.config.verifyHederaTx;
  }

  async verifyFundingWebhookSignature(
    input: VerifyFundingWebhookSignatureInput
  ): Promise<VerifyFundingWebhookSignatureResult> {
    const presentedFacilitatorId = input.facilitatorId ?? input.webhook.facilitatorId;
    const resolvedFacilitatorId = this.config.facilitatorId ?? presentedFacilitatorId;

    if (!this.config.requireSignedWebhook) {
      if (input.webhook.success) {
        if (!input.webhook.hederaTxId || input.webhook.hederaTxId.length === 0) {
          throw new AppError("hederaTxId is required when success=true", 400);
        }

        await this.verifyHederaTransaction(input.webhook.hederaTxId);
      }

      return {
        facilitatorId: resolvedFacilitatorId,
        signatureVerified: false,
        hederaTxVerified: this.config.verifyHederaTx
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

    if (input.webhook.success) {
      if (!input.webhook.hederaTxId || input.webhook.hederaTxId.length === 0) {
        throw new AppError("hederaTxId is required when success=true", 400);
      }

      await this.verifyHederaTransaction(input.webhook.hederaTxId);
    }

    return {
      facilitatorId: resolvedFacilitatorId,
      signatureVerified: true,
      hederaTxVerified: this.config.verifyHederaTx
    };
  }
}
