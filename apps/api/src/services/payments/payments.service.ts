import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { HcsAuditService } from "../hedera/hcs-audit.service.js";
import { getHederaConfig } from "../../config/hedera.config.js";
import { getX402Config } from "../../config/x402.config.js";
import {
  X402FacilitatorAdapter,
  type X402FacilitatorPaymentRequirements
} from "./x402-facilitator.adapter.js";
import { X402FacilitatorVerifierService } from "./x402-facilitator-verifier.service.js";

export type PaymentRequirement = {
  orderId: string;
  x402PaymentId: string;
  amount: string;
  asset: string;
  recipient: string;
  facilitatorMode: "hedera-compatible";
  paymentEndpoint: string;
  fundingWebhookEndpoint: string;
  facilitator: {
    id: string | null;
    requiresSignature: boolean;
    signatureAlgorithm: "hmac-sha256";
    signatureHeader: "x-x402-signature";
    timestampHeader: "x-x402-timestamp";
    facilitatorHeader: "x-x402-facilitator-id";
    timestampToleranceSeconds: number;
    canonicalPayloadTemplate: string;
  };
  x402: {
    x402Version: 1;
    paymentRequirements: X402FacilitatorPaymentRequirements;
  };
};

export type SubmitPaymentInput = {
  orderId: string;
  x402PaymentId: string;
  signedPayload: unknown;
  signature?: string;
  payerAccount?: string;
};

export type FundingWebhookInput = {
  x402PaymentId?: string;
  orderId?: string;
  success: boolean;
  hederaTxId?: string;
  facilitatorId?: string;
  payerAccount?: string;
  amount?: string;
  asset?: string;
};

function formatRequirement(input: {
  orderId: string;
  x402PaymentId: string;
  amount: Prisma.Decimal;
  asset: string;
  recipient: string;
  facilitatorId?: string;
  requiresSignature: boolean;
  signatureMaxAgeSeconds: number;
  x402PaymentRequirements: X402FacilitatorPaymentRequirements;
}): PaymentRequirement {
  return {
    orderId: input.orderId,
    x402PaymentId: input.x402PaymentId,
    amount: input.amount.toString(),
    asset: input.asset,
    recipient: input.recipient,
    facilitatorMode: "hedera-compatible",
    paymentEndpoint: `/api/orders/${input.orderId}/pay/submit`,
    fundingWebhookEndpoint: `/api/webhooks/x402`,
    facilitator: {
      id: input.facilitatorId ?? null,
      requiresSignature: input.requiresSignature,
      signatureAlgorithm: "hmac-sha256",
      signatureHeader: "x-x402-signature",
      timestampHeader: "x-x402-timestamp",
      facilitatorHeader: "x-x402-facilitator-id",
      timestampToleranceSeconds: input.signatureMaxAgeSeconds,
      canonicalPayloadTemplate:
        "{timestamp}.{x402PaymentId}|{orderId}|{success}|{hederaTxId}|{facilitatorId}|{payerAccount}|{amount}|{asset}"
    },
    x402: {
      x402Version: 1,
      paymentRequirements: input.x402PaymentRequirements
    }
  };
}

export class PaymentsService {
  private readonly hcsAuditService = new HcsAuditService();
  private readonly hederaConfig = getHederaConfig();
  private readonly x402Config = getX402Config();
  private readonly facilitatorAdapter = new X402FacilitatorAdapter();
  private readonly x402Verifier = new X402FacilitatorVerifierService();

  private getEscrowRecipient(): string {
    return this.hederaConfig.defaultEscrowAccountId ?? "platform-held-escrow-account";
  }

  private buildX402PaymentRequirements(input: {
    orderId: string;
    amount: Prisma.Decimal;
    asset: string;
    recipient: string;
  }): X402FacilitatorPaymentRequirements {
    const normalizedBase = this.x402Config.paymentResourceBaseUrl.replace(/\/+$/, "");
    const resource = `${normalizedBase}/api/orders/${input.orderId}/pay`;

    return {
      scheme: "exact",
      network: this.x402Config.paymentNetwork,
      maxAmountRequired: input.amount.toString(),
      resource,
      description: `${this.x402Config.paymentDescription} (${input.orderId})`,
      mimeType: this.x402Config.paymentMimeType,
      payTo: input.recipient,
      maxTimeoutSeconds: this.x402Config.paymentMaxTimeoutSeconds,
      asset: input.asset
    };
  }

  async createPaymentRequirement(orderId: string): Promise<PaymentRequirement> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.status !== "PAYMENT_PENDING") {
      throw new AppError("Order is not in PAYMENT_PENDING status", 409);
    }

    const existing = await prisma.fundingRecord.findUnique({
      where: { orderId }
    });

    if (existing?.status === "CONFIRMED") {
      throw new AppError("Order already funded", 409);
    }

    if (existing?.status === "PENDING") {
      return formatRequirement({
        orderId,
        x402PaymentId: existing.x402PaymentId,
        amount: existing.amount,
        asset: existing.asset,
        recipient: this.getEscrowRecipient(),
        facilitatorId: this.x402Config.facilitatorId,
        requiresSignature: this.x402Config.requireSignedWebhook,
        signatureMaxAgeSeconds: this.x402Config.signatureMaxAgeSeconds,
        x402PaymentRequirements: this.buildX402PaymentRequirements({
          orderId,
          amount: existing.amount,
          asset: existing.asset,
          recipient: this.getEscrowRecipient()
        })
      });
    }

    const paymentId = randomUUID();

    const funding = existing
      ? await prisma.fundingRecord.update({
          where: { id: existing.id },
          data: {
            x402PaymentId: paymentId,
            amount: order.amount,
            asset: order.currency,
            status: "PENDING",
            hederaTxId: null,
            facilitatorId: null,
            payerAccount: null,
            fundedAt: null
          }
        })
      : await prisma.fundingRecord.create({
          data: {
            orderId,
            x402PaymentId: paymentId,
            amount: order.amount,
            asset: order.currency,
            status: "PENDING"
          }
        });

    return formatRequirement({
      orderId,
      x402PaymentId: funding.x402PaymentId,
      amount: funding.amount,
      asset: funding.asset,
      recipient: this.getEscrowRecipient(),
      facilitatorId: this.x402Config.facilitatorId,
      requiresSignature: this.x402Config.requireSignedWebhook,
      signatureMaxAgeSeconds: this.x402Config.signatureMaxAgeSeconds,
      x402PaymentRequirements: this.buildX402PaymentRequirements({
        orderId,
        amount: funding.amount,
        asset: funding.asset,
        recipient: this.getEscrowRecipient()
      })
    });
  }

  async submitPaymentViaFacilitator(input: SubmitPaymentInput) {
    if (!this.facilitatorAdapter.isConfigured()) {
      throw new AppError(
        "Facilitator direct-pay endpoint is not configured. Set X402_FACILITATOR_API_BASE_URL.",
        501
      );
    }

    const funding = await prisma.fundingRecord.findUnique({
      where: {
        x402PaymentId: input.x402PaymentId
      },
      include: {
        order: true
      }
    });

    if (!funding) {
      throw new AppError("Funding record not found", 404);
    }

    if (funding.orderId !== input.orderId) {
      throw new AppError("orderId does not match x402PaymentId", 409);
    }

    if (funding.status === "CONFIRMED") {
      return {
        submitted: false,
        idempotent: true,
        orderId: funding.orderId,
        x402PaymentId: funding.x402PaymentId,
        fundingStatus: funding.status,
        orderStatus: funding.order.status,
        hederaTxId: funding.hederaTxId
      };
    }

    if (funding.order.status !== "PAYMENT_PENDING") {
      throw new AppError("Order is not in PAYMENT_PENDING status", 409);
    }

    if (funding.status !== "PENDING") {
      throw new AppError("Funding record is not pending", 409);
    }

    const facilitatorResponse = await this.facilitatorAdapter.submitSignedPayment({
      orderId: input.orderId,
      x402PaymentId: input.x402PaymentId,
      signedPayload: input.signedPayload,
      paymentRequirements: this.buildX402PaymentRequirements({
        orderId: funding.orderId,
        amount: funding.amount,
        asset: funding.asset,
        recipient: this.getEscrowRecipient()
      }),
      signature: input.signature,
      payerAccount: input.payerAccount,
      amount: funding.amount.toString(),
      asset: funding.asset,
      recipient: this.getEscrowRecipient()
    });

    if (!facilitatorResponse.success) {
      return {
        submitted: true,
        funded: false,
        orderId: funding.orderId,
        x402PaymentId: funding.x402PaymentId,
        facilitatorId: facilitatorResponse.facilitatorId ?? null
      };
    }

    const hederaTxId = facilitatorResponse.hederaTxId;
    if (!hederaTxId) {
      throw new AppError("Facilitator response is missing hederaTxId", 502);
    }

    const payerAccount = facilitatorResponse.payerAccount ?? input.payerAccount;
    if (!payerAccount || payerAccount.length === 0) {
      throw new AppError("payerAccount is required in facilitator response", 502);
    }

    const hederaTxVerified = await this.x402Verifier.verifyFundingTransactionIfEnabled(
      hederaTxId
    );

    const facilitatorId =
      facilitatorResponse.facilitatorId ?? this.x402Config.facilitatorId;
    if (!facilitatorId || facilitatorId.length === 0) {
      throw new AppError("facilitatorId is required in facilitator response", 502);
    }

    const processed = await this.processFundingWebhook({
      orderId: input.orderId,
      x402PaymentId: input.x402PaymentId,
      success: true,
      hederaTxId,
      facilitatorId,
      payerAccount,
      amount: facilitatorResponse.amount ?? funding.amount.toString(),
      asset: facilitatorResponse.asset ?? funding.asset
    });

    return {
      submitted: true,
      funded: true,
      hederaTxVerified,
      ...processed
    };
  }

  async processFundingWebhook(input: FundingWebhookInput) {
    if (!input.x402PaymentId && !input.orderId) {
      throw new AppError("x402PaymentId or orderId is required", 400);
    }

    const funding = input.x402PaymentId
      ? await prisma.fundingRecord.findUnique({
          where: { x402PaymentId: input.x402PaymentId },
          include: {
            order: true
          }
        })
      : await prisma.fundingRecord.findUnique({
          where: { orderId: input.orderId! },
          include: {
            order: true
          }
        });

    if (!funding) {
      throw new AppError("Funding record not found", 404);
    }

    if (input.orderId && funding.orderId !== input.orderId) {
      throw new AppError("orderId does not match x402PaymentId", 409);
    }

    if (input.success) {
      if (!input.hederaTxId || input.hederaTxId.length === 0) {
        throw new AppError("hederaTxId is required when success=true", 400);
      }

      if (!input.facilitatorId || input.facilitatorId.length === 0) {
        throw new AppError("facilitatorId is required when success=true", 400);
      }

      if (!input.payerAccount || input.payerAccount.length === 0) {
        throw new AppError("payerAccount is required when success=true", 400);
      }
    }

    if (input.amount) {
      let submittedAmount: Prisma.Decimal;
      try {
        submittedAmount = new Prisma.Decimal(input.amount);
      } catch {
        throw new AppError("amount must be a valid decimal string", 400);
      }

      if (!submittedAmount.equals(funding.amount)) {
        throw new AppError("amount does not match payment requirement", 409);
      }
    }

    if (input.asset && input.asset !== funding.asset) {
      throw new AppError("asset does not match payment requirement", 409);
    }

    if (funding.status === "CONFIRMED") {
      if (input.success) {
        const hederaTxMatches =
          !funding.hederaTxId || funding.hederaTxId === input.hederaTxId;

        if (!hederaTxMatches) {
          throw new AppError("hederaTxId mismatch for already confirmed funding", 409);
        }
      }

      return {
        orderId: funding.orderId,
        fundingStatus: funding.status,
        orderStatus: funding.order.status,
        hederaTxId: funding.hederaTxId,
        idempotent: true
      };
    }

    if (!input.success) {
      await prisma.fundingRecord.update({
        where: { id: funding.id },
        data: { status: "FAILED" }
      });

      return {
        orderId: funding.orderId,
        fundingStatus: "FAILED",
        orderStatus: funding.order.status,
        idempotent: false
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({ where: { id: funding.orderId } });
      if (!currentOrder) {
        throw new AppError("Order not found", 404);
      }

      try {
        assertTransition(currentOrder.status as OrderStatus, "FUNDED");
      } catch {
        throw new AppError(
          `Invalid order transition: ${currentOrder.status} -> FUNDED`,
          409
        );
      }

      const updatedFunding = await tx.fundingRecord.update({
        where: { id: funding.id },
        data: {
          status: "CONFIRMED",
          hederaTxId: input.hederaTxId,
          facilitatorId: input.facilitatorId,
          payerAccount: input.payerAccount,
          amount: input.amount ? new Prisma.Decimal(input.amount) : funding.amount,
          asset: input.asset ?? funding.asset,
          fundedAt: new Date()
        }
      });

      const updatedOrder = await tx.order.update({
        where: { id: currentOrder.id },
        data: { status: "FUNDED" }
      });

      await tx.hederaOrderLedger.upsert({
        where: { orderId: currentOrder.id },
        update: {
          hederaNetwork: this.hederaConfig.network,
          escrowAccountId: this.hederaConfig.defaultEscrowAccountId,
          fundingTxId: updatedFunding.hederaTxId,
          x402PaymentId: updatedFunding.x402PaymentId,
          facilitatorId: updatedFunding.facilitatorId,
          payerAccount: updatedFunding.payerAccount,
          asset: updatedFunding.asset,
          fundedAt: updatedFunding.fundedAt
        },
        create: {
          orderId: currentOrder.id,
          hederaNetwork: this.hederaConfig.network,
          escrowAccountId: this.hederaConfig.defaultEscrowAccountId,
          fundingTxId: updatedFunding.hederaTxId,
          x402PaymentId: updatedFunding.x402PaymentId,
          facilitatorId: updatedFunding.facilitatorId,
          payerAccount: updatedFunding.payerAccount,
          asset: updatedFunding.asset,
          fundedAt: updatedFunding.fundedAt
        }
      });

      return { updatedFunding, updatedOrder };
    });

    await this.hcsAuditService.publishEvent({
      eventType: "order.funded",
      orderId: updated.updatedOrder.id,
      txId: updated.updatedFunding.hederaTxId ?? undefined,
      payload: {
        amount: updated.updatedFunding.amount.toString(),
        asset: updated.updatedFunding.asset,
        payerAccount: updated.updatedFunding.payerAccount,
        facilitatorId: updated.updatedFunding.facilitatorId
      }
    });

    return {
      orderId: updated.updatedOrder.id,
      fundingStatus: updated.updatedFunding.status,
      orderStatus: updated.updatedOrder.status,
      hederaTxId: updated.updatedFunding.hederaTxId,
      idempotent: false
    };
  }
}
