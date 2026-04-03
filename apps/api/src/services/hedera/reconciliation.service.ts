import { HcsEventType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";

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

    return {
      orderId: payload.orderId,
      txType: payload.txType,
      txId: payload.txId,
      status: payload.status
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
