import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";

export type PaymentRequirement = {
  orderId: string;
  x402PaymentId: string;
  amount: string;
  asset: string;
  recipient: string;
  facilitatorMode: "hedera-compatible";
  paymentEndpoint: string;
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
}): PaymentRequirement {
  return {
    orderId: input.orderId,
    x402PaymentId: input.x402PaymentId,
    amount: input.amount.toString(),
    asset: input.asset,
    recipient: "platform-held-escrow-account",
    facilitatorMode: "hedera-compatible",
    paymentEndpoint: `/api/webhooks/x402`
  };
}

export class PaymentsService {
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
        asset: existing.asset
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
      asset: funding.asset
    });
  }

  async processFundingWebhook(input: FundingWebhookInput) {
    if (!input.x402PaymentId && !input.orderId) {
      throw new AppError("x402PaymentId or orderId is required", 400);
    }

    const funding = await prisma.fundingRecord.findFirst({
      where: {
        OR: [
          input.x402PaymentId ? { x402PaymentId: input.x402PaymentId } : undefined,
          input.orderId ? { orderId: input.orderId } : undefined
        ].filter(Boolean) as Prisma.FundingRecordWhereInput[]
      },
      include: {
        order: true
      }
    });

    if (!funding) {
      throw new AppError("Funding record not found", 404);
    }

    if (!input.success) {
      await prisma.fundingRecord.update({
        where: { id: funding.id },
        data: { status: "FAILED" }
      });

      return {
        orderId: funding.orderId,
        fundingStatus: "FAILED",
        orderStatus: funding.order.status
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

      return { updatedFunding, updatedOrder };
    });

    return {
      orderId: updated.updatedOrder.id,
      fundingStatus: updated.updatedFunding.status,
      orderStatus: updated.updatedOrder.status,
      hederaTxId: updated.updatedFunding.hederaTxId
    };
  }
}
