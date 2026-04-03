import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";

export type AutoReleaseSchedule = {
  scheduleId: string;
  releaseAt: Date;
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

export class ScheduledReleaseService {
  ensureAdminKeyConfigured(): void {
    getAdminKeyOrThrow();
  }

  async createAutoReleaseSchedule(input: {
    orderId: string;
    proofSubmittedAt: Date;
    reviewWindowHours: number;
  }): Promise<AutoReleaseSchedule> {
    getAdminKeyOrThrow();

    const releaseAt = new Date(
      input.proofSubmittedAt.getTime() + input.reviewWindowHours * 60 * 60 * 1000
    );
    const scheduleId = `sched_${randomUUID()}`;

    await prisma.hederaOrderLedger.upsert({
      where: { orderId: input.orderId },
      update: {
        scheduleId,
        hederaNetwork: "testnet"
      },
      create: {
        orderId: input.orderId,
        scheduleId,
        hederaNetwork: "testnet"
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
      releaseAt
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

    await prisma.order.update({
      where: { id: orderId },
      data: { scheduleId: null }
    });

    await prisma.hederaOrderLedger.updateMany({
      where: { orderId },
      data: { scheduleId: null }
    });

    return { scheduleId: order.scheduleId };
  }
}
