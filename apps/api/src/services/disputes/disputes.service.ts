import { DisputeResolution, DisputeStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { hbarToTinybars, isHederaAccountId, tinybarsToHbar } from "../../lib/hbar.js";
import { ScheduledReleaseService } from "../hedera/scheduled-release.service.js";
import { HederaRuntimeService } from "../hedera/hedera-runtime.service.js";
import { HcsAuditService } from "../hedera/hcs-audit.service.js";
import { ReputationService } from "../reputation/reputation.service.js";
import { getHederaConfig } from "../../config/hedera.config.js";

const RESOLUTION_TO_ORDER_STATUS: Record<DisputeResolution, OrderStatus> = {
  RELEASE_TO_WORKER: "APPROVED",
  REFUND_CLIENT: "REFUNDED",
  SPLIT_PAYMENT: "SPLIT_SETTLED"
};

function parseAssignedReviewerIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getMajorityResolution(
  votes: Array<{ vote: DisputeResolution }>
): DisputeResolution | null {
  const counts = {
    RELEASE_TO_WORKER: 0,
    REFUND_CLIENT: 0,
    SPLIT_PAYMENT: 0
  };

  for (const vote of votes) {
    counts[vote.vote] += 1;
  }

  if (counts.RELEASE_TO_WORKER >= 2) {
    return "RELEASE_TO_WORKER";
  }

  if (counts.REFUND_CLIENT >= 2) {
    return "REFUND_CLIENT";
  }

  if (counts.SPLIT_PAYMENT >= 2) {
    return "SPLIT_PAYMENT";
  }

  return null;
}

export class DisputesService {
  private readonly scheduledReleaseService = new ScheduledReleaseService();
  private readonly hederaRuntime = new HederaRuntimeService();
  private readonly hcsAuditService = new HcsAuditService();
  private readonly reputationService = new ReputationService();
  private readonly hederaConfig = getHederaConfig();

  private resolveLocalSettlementTxId(resolution: DisputeResolution): string {
    return `${resolution.toLowerCase()}_${randomUUID()}`;
  }

  private ensureClientAccountId(order: { clientAccountId: string | null }): string {
    if (!order.clientAccountId || !isHederaAccountId(order.clientAccountId)) {
      throw new AppError(
        "clientAccountId must be a Hedera account id (for example 0.0.1234) for refund/split settlement",
        409
      );
    }

    return order.clientAccountId;
  }

  private async executeResolutionTransfers(input: {
    orderId: string;
    resolution: DisputeResolution;
    workerAccountId: string;
    clientAccountId: string | null;
    amount: string;
    currency: string;
  }): Promise<{ releaseTxId: string | null; refundTxId: string | null }> {
    if (!this.hederaRuntime.isEnabled()) {
      const txId = this.resolveLocalSettlementTxId(input.resolution);

      if (input.resolution === "RELEASE_TO_WORKER") {
        return { releaseTxId: txId, refundTxId: null };
      }

      if (input.resolution === "REFUND_CLIENT") {
        return { releaseTxId: null, refundTxId: txId };
      }

      const splitTxId = `split_${randomUUID()}`;
      return {
        releaseTxId: splitTxId,
        refundTxId: splitTxId
      };
    }

    if (input.currency !== "HBAR") {
      throw new AppError("Only HBAR settlements are supported", 409);
    }

    if (!isHederaAccountId(input.workerAccountId)) {
      throw new AppError(
        "Worker walletAddress must be a Hedera account id (for example 0.0.1234)",
        409
      );
    }

    if (input.resolution === "RELEASE_TO_WORKER") {
      const release = await this.hederaRuntime.executeHbarTransfer({
        transfers: [{ accountId: input.workerAccountId, amountHbar: input.amount }],
        memo: `haas.order.${input.orderId}.dispute.release`
      });

      if (!release) {
        throw new AppError("Failed to execute release transfer", 500);
      }

      return { releaseTxId: release.txId, refundTxId: null };
    }

    const clientAccountId = this.ensureClientAccountId({
      clientAccountId: input.clientAccountId
    });

    if (input.resolution === "REFUND_CLIENT") {
      const refund = await this.hederaRuntime.executeHbarTransfer({
        transfers: [{ accountId: clientAccountId, amountHbar: input.amount }],
        memo: `haas.order.${input.orderId}.dispute.refund`
      });

      if (!refund) {
        throw new AppError("Failed to execute refund transfer", 500);
      }

      return { releaseTxId: null, refundTxId: refund.txId };
    }

    const totalTinybars = hbarToTinybars(input.amount);
    const workerTinybars = totalTinybars / 2n;
    const clientTinybars = totalTinybars - workerTinybars;

    const splitTransfer = await this.hederaRuntime.executeHbarTransfer({
      transfers: [
        {
          accountId: input.workerAccountId,
          amountHbar: tinybarsToHbar(workerTinybars)
        },
        {
          accountId: clientAccountId,
          amountHbar: tinybarsToHbar(clientTinybars)
        }
      ],
      memo: `haas.order.${input.orderId}.dispute.split`
    });

    if (!splitTransfer) {
      throw new AppError("Failed to execute split transfer", 500);
    }

    return {
      releaseTxId: splitTransfer.txId,
      refundTxId: splitTransfer.txId
    };
  }

  async openDispute(
    orderId: string,
    input: {
      reasonCode: string;
      clientStatement: string;
      workerStatement?: string;
      actorId?: string;
    }
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.status !== "REVIEW_WINDOW") {
      throw new AppError("Order can only be disputed from REVIEW_WINDOW", 409);
    }

    const existing = await prisma.disputeCase.findUnique({
      where: { orderId }
    });

    if (existing) {
      throw new AppError("Dispute already exists for this order", 409);
    }

    const reviewers = await prisma.workerProfile.findMany({
      where: {
        reviewerEligible: true,
        isSuspended: false,
        isBanned: false,
        id: {
          not: order.workerId
        },
        verifiedHuman: {
          worldVerified: true
        }
      },
      select: {
        verifiedHumanId: true
      },
      orderBy: [
        {
          reputationScore: "desc"
        },
        {
          completedJobs: "desc"
        }
      ],
      take: 3
    });

    if (reviewers.length < 3) {
      throw new AppError("At least 3 eligible reviewers are required", 409);
    }

    const reviewerIds = reviewers.map((reviewer) => reviewer.verifiedHumanId);

    const cancelledSchedule = await this.scheduledReleaseService.cancelAutoReleaseSchedule(
      orderId
    );

    const dispute = await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });

      if (!currentOrder) {
        throw new AppError("Order not found", 404);
      }

      try {
        assertTransition(currentOrder.status as OrderStatus, "DISPUTED");
      } catch {
        throw new AppError(
          `Invalid order transition: ${currentOrder.status} -> DISPUTED`,
          409
        );
      }

      await tx.order.update({
        where: { id: currentOrder.id },
        data: {
          status: "DISPUTED",
          scheduleId: null
        }
      });

      return tx.disputeCase.create({
        data: {
          orderId,
          reasonCode: input.reasonCode,
          clientStatement: input.clientStatement,
          workerStatement: input.workerStatement,
          assignedReviewerIds: reviewerIds,
          status: DisputeStatus.OPEN
        }
      });
    });

    await this.hcsAuditService.publishEvent({
      eventType: "order.disputed",
      orderId,
      actorId: input.actorId,
      payload: {
        reasonCode: input.reasonCode,
        assignedReviewerIds: reviewerIds,
        cancelledScheduleId: cancelledSchedule?.scheduleId ?? null,
        scheduleCancelTxId: cancelledSchedule?.cancellationTxId ?? null
      }
    });

    return {
      id: dispute.id,
      orderId: dispute.orderId,
      reasonCode: dispute.reasonCode,
      clientStatement: dispute.clientStatement,
      workerStatement: dispute.workerStatement,
      assignedReviewerIds: reviewerIds,
      status: dispute.status
    };
  }

  async getDispute(orderId: string) {
    const dispute = await prisma.disputeCase.findUnique({
      where: { orderId },
      include: {
        votes: true
      }
    });

    if (!dispute) {
      throw new AppError("Dispute not found", 404);
    }

    return {
      id: dispute.id,
      orderId: dispute.orderId,
      reasonCode: dispute.reasonCode,
      clientStatement: dispute.clientStatement,
      workerStatement: dispute.workerStatement,
      assignedReviewerIds: parseAssignedReviewerIds(dispute.assignedReviewerIds),
      status: dispute.status,
      resolution: dispute.resolution,
      resolvedAt: dispute.resolvedAt,
      votes: dispute.votes.map((vote) => ({
        reviewerId: vote.reviewerId,
        vote: vote.vote,
        submittedAt: vote.submittedAt
      }))
    };
  }

  async submitWorkerResponse(
    orderId: string,
    input: { workerStatement: string; actorId?: string }
  ) {
    const dispute = await prisma.disputeCase.findUnique({
      where: { orderId },
      include: {
        order: {
          select: {
            workerId: true
          }
        }
      }
    });

    if (!dispute) {
      throw new AppError("Dispute not found", 404);
    }

    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new AppError("Dispute already resolved", 409);
    }

    const updated = await prisma.disputeCase.update({
      where: { id: dispute.id },
      data: {
        workerStatement: input.workerStatement
      }
    });

    return {
      id: updated.id,
      orderId: updated.orderId,
      workerId: dispute.order.workerId,
      workerStatement: updated.workerStatement,
      status: updated.status,
      actorId: input.actorId ?? null
    };
  }

  async submitReviewerVote(
    orderId: string,
    input: { reviewerId: string; vote: DisputeResolution }
  ) {
    const dispute = await prisma.disputeCase.findUnique({
      where: { orderId },
      include: {
        votes: true,
        order: true
      }
    });

    if (!dispute) {
      throw new AppError("Dispute not found", 404);
    }

    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new AppError("Dispute already resolved", 409);
    }

    const assignedReviewerIds = parseAssignedReviewerIds(dispute.assignedReviewerIds);

    if (!assignedReviewerIds.includes(input.reviewerId)) {
      throw new AppError("Reviewer is not assigned to this dispute", 403);
    }

    await prisma.disputeVote.upsert({
      where: {
        disputeCaseId_reviewerId: {
          disputeCaseId: dispute.id,
          reviewerId: input.reviewerId
        }
      },
      update: {
        vote: input.vote,
        submittedAt: new Date()
      },
      create: {
        disputeCaseId: dispute.id,
        reviewerId: input.reviewerId,
        vote: input.vote
      }
    });

    await this.hcsAuditService.publishEvent({
      eventType: "reviewer.vote.submitted",
      orderId,
      actorId: input.reviewerId,
      payload: {
        vote: input.vote
      }
    });

    const votes = await prisma.disputeVote.findMany({
      where: { disputeCaseId: dispute.id },
      orderBy: { submittedAt: "asc" }
    });

    const majorityResolution = getMajorityResolution(votes);

    if (!majorityResolution) {
      return {
        resolved: false,
        votesCount: votes.length,
        resolution: null
      };
    }

    const targetOrderStatus = RESOLUTION_TO_ORDER_STATUS[majorityResolution];
    const settlementOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        clientAccountId: true,
        worker: {
          select: {
            verifiedHuman: {
              select: {
                walletAddress: true
              }
            }
          }
        }
      }
    });

    if (!settlementOrder) {
      throw new AppError("Order not found", 404);
    }

    const settlementTransfers = await this.executeResolutionTransfers({
      orderId,
      resolution: majorityResolution,
      workerAccountId: settlementOrder.worker.verifiedHuman.walletAddress ?? "",
      clientAccountId: settlementOrder.clientAccountId,
      amount: settlementOrder.amount.toString(),
      currency: settlementOrder.currency
    });

    const settlementTxId =
      settlementTransfers.releaseTxId ?? settlementTransfers.refundTxId;

    if (!settlementTxId) {
      throw new AppError("Settlement transaction id is missing", 500);
    }

    const resolved = await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!currentOrder) {
        throw new AppError("Order not found", 404);
      }

      try {
        assertTransition(currentOrder.status as OrderStatus, targetOrderStatus);
      } catch {
        throw new AppError(
          `Invalid order transition: ${currentOrder.status} -> ${targetOrderStatus}`,
          409
        );
      }

      const resolvedDispute = await tx.disputeCase.update({
        where: { id: dispute.id },
        data: {
          status: DisputeStatus.RESOLVED,
          resolution: majorityResolution,
          resolvedAt: new Date()
        }
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: targetOrderStatus,
          scheduleId: null
        }
      });

      await tx.hederaOrderLedger.upsert({
        where: { orderId },
        update: {
          releaseTxId: settlementTransfers.releaseTxId ?? undefined,
          refundTxId: settlementTransfers.refundTxId ?? undefined
        },
        create: {
          orderId,
          hederaNetwork: this.hederaConfig.network,
          releaseTxId: settlementTransfers.releaseTxId ?? null,
          refundTxId: settlementTransfers.refundTxId ?? null
        }
      });

      return {
        resolvedDispute,
        updatedOrder
      };
    });

    await this.hcsAuditService.publishEvent({
      eventType: "order.resolved",
      orderId,
      resolution: majorityResolution,
      txId: settlementTxId,
      payload: {
        finalOrderStatus: resolved.updatedOrder.status,
        releaseTxId: settlementTransfers.releaseTxId,
        refundTxId: settlementTransfers.refundTxId
      }
    });

    if (majorityResolution === "REFUND_CLIENT") {
      await this.hcsAuditService.publishEvent({
        eventType: "order.refunded",
        orderId,
        txId: settlementTransfers.refundTxId ?? settlementTxId
      });
    }

    await this.reputationService.recordOrderOutcome({
      orderId,
      approved: majorityResolution !== "REFUND_CLIENT",
      disputed: true,
      disputeOutcome: majorityResolution
    });

    await this.reputationService.updateReviewerReputationForDispute(dispute.id);

    return {
      resolved: true,
      resolution: majorityResolution,
      orderStatus: resolved.updatedOrder.status,
      txId: settlementTxId,
      releaseTxId: settlementTransfers.releaseTxId,
      refundTxId: settlementTransfers.refundTxId
    };
  }
}
