import { randomUUID } from "node:crypto";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { ScheduledReleaseService } from "../hedera/scheduled-release.service.js";
import { HcsAuditService } from "../hedera/hcs-audit.service.js";
import { ReputationService } from "../reputation/reputation.service.js";

export class SettlementService {
  private readonly scheduledReleaseService = new ScheduledReleaseService();
  private readonly hcsAuditService = new HcsAuditService();
  private readonly reputationService = new ReputationService();

  async approveOrder(orderId: string, actorId?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.status !== "REVIEW_WINDOW") {
      throw new AppError("Order can only be approved from REVIEW_WINDOW", 409);
    }

    const cancelledSchedule = await this.scheduledReleaseService.cancelAutoReleaseSchedule(
      orderId
    );

    const releaseTxId = `release_${randomUUID()}`;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!currentOrder) {
        throw new AppError("Order not found", 404);
      }

      try {
        assertTransition(currentOrder.status as OrderStatus, "APPROVED");
      } catch {
        throw new AppError(
          `Invalid order transition: ${currentOrder.status} -> APPROVED`,
          409
        );
      }

      const approved = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "APPROVED",
          scheduleId: null
        }
      });

      await tx.hederaOrderLedger.upsert({
        where: { orderId },
        update: {
          releaseTxId,
          scheduleId: null
        },
        create: {
          orderId,
          hederaNetwork: "testnet",
          releaseTxId,
          scheduleId: null
        }
      });

      return approved;
    });

    await this.hcsAuditService.publishEvent({
      eventType: "order.approved",
      orderId,
      actorId,
      txId: releaseTxId,
      payload: {
        cancelledScheduleId: cancelledSchedule?.scheduleId ?? null
      }
    });

    await this.reputationService.recordOrderOutcome({
      orderId,
      approved: true,
      disputed: false
    });

    return {
      orderId: updatedOrder.id,
      orderStatus: updatedOrder.status,
      releaseTxId,
      cancelledScheduleId: cancelledSchedule?.scheduleId ?? null
    };
  }
}
