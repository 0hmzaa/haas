import { HcsEventType } from "@prisma/client";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { HcsAuditService } from "./hcs-audit.service.js";
import { ReputationService } from "../reputation/reputation.service.js";

const EVENT_LABELS: Record<HcsEventType, string> = {
  order_created: "order.created",
  order_funded: "order.funded",
  order_started: "order.started",
  proof_submitted: "proof.submitted",
  review_window_started: "review.window.started",
  order_approved: "order.approved",
  order_disputed: "order.disputed",
  reviewer_vote_submitted: "reviewer.vote.submitted",
  order_resolved: "order.resolved",
  order_auto_released: "order.auto_released",
  order_refunded: "order.refunded"
};

export type HederaWebhookPayload = {
  orderId: string;
  txType: "FUNDING" | "RELEASE" | "REFUND" | "PROOF_EVENT" | "DISPUTE_EVENT";
  txId: string;
  status: "SUCCESS" | "FAILED";
  topicId?: string;
  sequence?: string;
};

export class ReconciliationService {
  private readonly hcsAuditService = new HcsAuditService();
  private readonly reputationService = new ReputationService();

  async processHederaWebhook(payload: HederaWebhookPayload) {
    const order = await prisma.order.findUnique({ where: { id: payload.orderId } });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    await prisma.hederaOrderLedger.upsert({
      where: { orderId: payload.orderId },
      update: {
        hederaNetwork: "testnet",
        topicId: payload.topicId,
        fundingTxId: payload.txType === "FUNDING" ? payload.txId : undefined,
        releaseTxId: payload.txType === "RELEASE" ? payload.txId : undefined,
        refundTxId: payload.txType === "REFUND" ? payload.txId : undefined,
        proofMessageSequence:
          payload.txType === "PROOF_EVENT" ? payload.sequence ?? payload.txId : undefined,
        disputeMessageSequence:
          payload.txType === "DISPUTE_EVENT" ? payload.sequence ?? payload.txId : undefined
      },
      create: {
        orderId: payload.orderId,
        hederaNetwork: "testnet",
        topicId: payload.topicId,
        fundingTxId: payload.txType === "FUNDING" ? payload.txId : null,
        releaseTxId: payload.txType === "RELEASE" ? payload.txId : null,
        refundTxId: payload.txType === "REFUND" ? payload.txId : null,
        proofMessageSequence:
          payload.txType === "PROOF_EVENT" ? payload.sequence ?? payload.txId : null,
        disputeMessageSequence:
          payload.txType === "DISPUTE_EVENT" ? payload.sequence ?? payload.txId : null
      }
    });

    let orderStatus = order.status;
    let autoReleased = false;

    if (
      payload.txType === "RELEASE" &&
      payload.status === "SUCCESS" &&
      order.status === "REVIEW_WINDOW"
    ) {
      if (!order.proofSubmittedAt) {
        throw new AppError(
          "proofSubmittedAt is required to reconcile auto-release timing",
          409
        );
      }

      const reviewWindowEndsAt = new Date(
        order.proofSubmittedAt.getTime() + order.reviewWindowHours * 60 * 60 * 1000
      );

      if (Date.now() < reviewWindowEndsAt.getTime()) {
        throw new AppError(
          `Review window still active until ${reviewWindowEndsAt.toISOString()}`,
          409
        );
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: payload.orderId }
        });

        if (!current) {
          throw new AppError("Order not found", 404);
        }

        try {
          assertTransition(current.status as OrderStatus, "AUTO_RELEASED");
        } catch {
          throw new AppError(
            `Invalid order transition: ${current.status} -> AUTO_RELEASED`,
            409
          );
        }

        await tx.hederaOrderLedger.upsert({
          where: { orderId: payload.orderId },
          update: {
            releaseTxId: payload.txId,
            scheduleId: null
          },
          create: {
            orderId: payload.orderId,
            hederaNetwork: "testnet",
            releaseTxId: payload.txId
          }
        });

        return tx.order.update({
          where: { id: payload.orderId },
          data: {
            status: "AUTO_RELEASED",
            scheduleId: null
          }
        });
      });

      await this.hcsAuditService.publishEvent({
        eventType: "order.auto_released",
        orderId: payload.orderId,
        txId: payload.txId,
        payload: {
          source: "hedera_webhook",
          reviewWindowEndedAt: reviewWindowEndsAt.toISOString()
        }
      });

      await this.reputationService.recordOrderOutcome({
        orderId: payload.orderId,
        approved: true,
        disputed: false
      });

      orderStatus = updatedOrder.status;
      autoReleased = true;
    }

    return {
      orderId: payload.orderId,
      txType: payload.txType,
      txId: payload.txId,
      status: payload.status,
      orderStatus,
      autoReleased
    };
  }

  async getOrderAuditTimeline(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        funding: true,
        hederaLedger: true,
        hcsEvents: {
          orderBy: {
            timestamp: "asc"
          }
        }
      }
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    const timeline = order.hcsEvents.map((event) => ({
      timestamp: event.timestamp,
      eventType: EVENT_LABELS[event.eventType],
      actorId: event.actorId,
      txId: event.txId,
      nonce: event.nonce,
      proofHash: event.proofHash,
      storageRef: event.storageRef,
      resolution: event.resolution
    }));

    const checks = {
      fundingConfirmed: order.funding?.status === "CONFIRMED",
      proofAnchored:
        !order.proofSubmittedAt ||
        order.hcsEvents.some((event) => event.eventType === "proof_submitted"),
      reviewWindowAnchored:
        order.status !== "REVIEW_WINDOW" ||
        order.hcsEvents.some((event) => event.eventType === "review_window_started"),
      scheduleConsistent:
        order.status !== "REVIEW_WINDOW" || order.scheduleId !== null || !!order.hederaLedger?.scheduleId
    };

    return {
      order: {
        id: order.id,
        status: order.status,
        proofSubmittedAt: order.proofSubmittedAt,
        scheduleId: order.scheduleId
      },
      funding: order.funding
        ? {
            status: order.funding.status,
            x402PaymentId: order.funding.x402PaymentId,
            hederaTxId: order.funding.hederaTxId,
            fundedAt: order.funding.fundedAt
          }
        : null,
      ledger: order.hederaLedger,
      checks,
      timeline
    };
  }
}
