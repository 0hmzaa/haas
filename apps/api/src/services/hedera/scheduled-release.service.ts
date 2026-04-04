import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { HederaRuntimeService } from "./hedera-runtime.service.js";

export type AutoReleaseSchedule = {
  scheduleId: string | null;
  releaseAt: Date;
  scheduleCreateTxId: string | null;
};

function getAdminKeyOrThrow(): string {
  const adminKey = process.env.HEDERA_SCHEDULE_ADMIN_KEY;

  if (!adminKey || adminKey.length === 0) {
    throw new AppError(
      "HEDERA_SCHEDULE_ADMIN_KEY is required to create cancellable timeout schedules",
      500
    );
  }

  return adminKey;
}

const LOCAL_SCHEDULE_PREFIX = "sched_local_";

function isHederaAccountId(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function isLocalScheduleId(scheduleId: string): boolean {
  return scheduleId.startsWith(LOCAL_SCHEDULE_PREFIX);
}

export class ScheduledReleaseService {
  private readonly hederaRuntime = new HederaRuntimeService();

  ensureAdminKeyConfigured(): void {
    getAdminKeyOrThrow();
  }

  async createAutoReleaseSchedule(input: {
    orderId: string;
    proofSubmittedAt: Date;
    reviewWindowHours: number;
  }): Promise<AutoReleaseSchedule> {
    if (input.reviewWindowHours < 0) {
      throw new AppError("reviewWindowHours must be >= 0", 400);
    }

    const releaseAt =
      input.reviewWindowHours === 0
        ? new Date(input.proofSubmittedAt)
        : new Date(
            input.proofSubmittedAt.getTime() + input.reviewWindowHours * 60 * 60 * 1000
          );

    const hederaConfig = this.hederaRuntime.getConfig();

    if (input.reviewWindowHours === 0) {
      await prisma.hederaOrderLedger.upsert({
        where: { orderId: input.orderId },
        update: {
          scheduleId: null,
          hederaNetwork: hederaConfig.network,
          escrowAccountId: hederaConfig.defaultEscrowAccountId
        },
        create: {
          orderId: input.orderId,
          scheduleId: null,
          hederaNetwork: hederaConfig.network,
          escrowAccountId: hederaConfig.defaultEscrowAccountId
        }
      });

      await prisma.order.update({
        where: { id: input.orderId },
        data: {
          scheduleId: null
        }
      });

      return {
        scheduleId: null,
        releaseAt,
        scheduleCreateTxId: null
      };
    }

    getAdminKeyOrThrow();

    let scheduleId = `${LOCAL_SCHEDULE_PREFIX}${randomUUID()}`;
    let scheduleCreateTxId: string | null = null;

    if (this.hederaRuntime.isEnabled()) {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        select: {
          amount: true,
          currency: true,
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

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      if (order.currency !== "HBAR") {
        throw new AppError(
          "Only HBAR settlements are supported for Hedera scheduled release",
          409
        );
      }

      const receiverAccountId = order.worker.verifiedHuman.walletAddress;

      if (!receiverAccountId || !isHederaAccountId(receiverAccountId)) {
        throw new AppError(
          "Worker walletAddress must be a Hedera account id (for example 0.0.1234)",
          409
        );
      }

      const created = await this.hederaRuntime.createScheduledRelease({
        receiverAccountId,
        amountHbar: order.amount.toString(),
        executeAt: releaseAt,
        memo: `haas.order.${input.orderId}.auto-release`
      });

      if (!created) {
        throw new AppError("Failed to create Hedera auto-release schedule", 500);
      }

      scheduleId = created.scheduleId;
      scheduleCreateTxId = created.txId;
    }

    await prisma.hederaOrderLedger.upsert({
      where: { orderId: input.orderId },
      update: {
        scheduleId,
        hederaNetwork: hederaConfig.network,
        escrowAccountId: hederaConfig.defaultEscrowAccountId
      },
      create: {
        orderId: input.orderId,
        scheduleId,
        hederaNetwork: hederaConfig.network,
        escrowAccountId: hederaConfig.defaultEscrowAccountId
      }
    });

    await prisma.order.update({
      where: { id: input.orderId },
      data: {
        scheduleId
      }
    });

    return {
      scheduleId,
      releaseAt,
      scheduleCreateTxId
    };
  }

  async cancelAutoReleaseSchedule(orderId: string) {
    getAdminKeyOrThrow();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { scheduleId: true }
    });

    if (!order?.scheduleId) {
      return null;
    }

    let cancellationTxId: string | null = null;

    if (this.hederaRuntime.isEnabled() && !isLocalScheduleId(order.scheduleId)) {
      const cancellation = await this.hederaRuntime.deleteSchedule(order.scheduleId);
      cancellationTxId = cancellation?.txId ?? null;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { scheduleId: null }
    });

    await prisma.hederaOrderLedger.updateMany({
      where: { orderId },
      data: { scheduleId: null }
    });

    return {
      scheduleId: order.scheduleId,
      cancellationTxId
    };
  }
}
