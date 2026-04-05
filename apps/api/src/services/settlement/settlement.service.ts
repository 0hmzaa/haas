import { randomUUID } from "node:crypto";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { isHederaAccountId } from "../../lib/hbar.js";
import { ScheduledReleaseService } from "../hedera/scheduled-release.service.js";
import { HederaRuntimeService } from "../hedera/hedera-runtime.service.js";
import { HcsAuditService } from "../hedera/hcs-audit.service.js";
import { ReputationService } from "../reputation/reputation.service.js";
import { getHederaConfig } from "../../config/hedera.config.js";

export class SettlementService {
  private readonly scheduledReleaseService = new ScheduledReleaseService();
  private readonly hederaRuntime = new HederaRuntimeService();
  private readonly hcsAuditService = new HcsAuditService();
  private readonly reputationService = new ReputationService();
  private readonly hederaConfig = getHederaConfig();

  private assertClientOwnership(order: {
    clientId: string;
    clientAccountId: string | null;
  }, input: { actorId?: string; clientAccountId?: string }): void {
    if (order.clientAccountId) {
      if (input.clientAccountId !== order.clientAccountId) {
        throw new AppError(
          "Only the order client account can approve this order",
          403
        );
      }
      return;
    }

    if (!input.actorId || input.actorId !== order.clientId) {
      throw new AppError("Only the order client can approve this order", 403);
    }
  }

  private async executeReleaseTransfer(order: {
    id: string;
    currency: string;
  } | null): Promise<string> {
    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (!this.hederaRuntime.isEnabled()) {
      return `release_${randomUUID()}`;
    }

    if (order.currency !== "HBAR") {
      throw new AppError("Only HBAR settlements are supported", 409);
    }

    const detailedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      select: {
        id: true,
        amount: true,
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

    if (!detailedOrder) {
      throw new AppError("Order not found", 404);
    }

    const workerAccountId = detailedOrder.worker.verifiedHuman.walletAddress;
    if (!workerAccountId || !isHederaAccountId(workerAccountId)) {
      throw new AppError(
        "Worker walletAddress must be a Hedera account id (for example 0.0.1234)",
        409
      );
    }

    const transfer = await this.hederaRuntime.executeHbarTransfer({
      transfers: [
        {
          accountId: workerAccountId,
          amountHbar: detailedOrder.amount.toString()
        }
      ],
      memo: `haas.order.${detailedOrder.id}.approve.release`
    });

    if (!transfer) {
      throw new AppError("Failed to execute release transfer", 500);
    }

    return transfer.txId;
  }

  async approveOrder(
    orderId: string,
    input: { actorId?: string; clientAccountId?: string }
  ) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    this.assertClientOwnership(order, input);

    if (order.status !== "REVIEW_WINDOW") {
      throw new AppError("Order can only be approved from REVIEW_WINDOW", 409);
    }

    const cancelledSchedule = await this.scheduledReleaseService.cancelAutoReleaseSchedule(
      orderId
    );

    const releaseTxId = await this.executeReleaseTransfer(order);

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
          hederaNetwork: this.hederaConfig.network,
          releaseTxId,
          scheduleId: null
        }
      });

      return approved;
    });

    await this.hcsAuditService.publishEvent({
      eventType: "order.approved",
      orderId,
      actorId: input.actorId,
      txId: releaseTxId,
      payload: {
        cancelledScheduleId: cancelledSchedule?.scheduleId ?? null,
        scheduleCancelTxId: cancelledSchedule?.cancellationTxId ?? null
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
      cancelledScheduleId: cancelledSchedule?.scheduleId ?? null,
      scheduleCancelTxId: cancelledSchedule?.cancellationTxId ?? null
    };
  }
}
