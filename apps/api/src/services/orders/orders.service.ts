import { Prisma } from "@prisma/client";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { HcsAuditService } from "../hedera/hcs-audit.service.js";
import { TaskPolicyService } from "../policy/task-policy.service.js";

export type CreateOrderInput = {
  clientId: string;
  clientAccountId?: string;
  workerId: string;
  title: string;
  objective: string;
  instructions: string;
  locationContext?: string;
  deadlineAt?: string;
  expectedDurationMinutes?: number;
  requiredProofSchema?: Prisma.InputJsonValue;
  acceptanceCriteria?: Prisma.InputJsonValue;
  amount: string;
  currency?: string;
  platformFeeBps?: number;
  reviewerFeeReserve?: string;
  reviewWindowHours?: number;
};

type OrderShape = {
  id: string;
  clientId: string;
  clientAccountId: string | null;
  workerId: string;
  title: string;
  objective: string;
  instructions: string;
  locationContext: string | null;
  deadlineAt: Date | null;
  expectedDurationMinutes: number | null;
  requiredProofSchema: Prisma.JsonValue | null;
  acceptanceCriteria: Prisma.JsonValue | null;
  amount: Prisma.Decimal;
  currency: string;
  platformFeeBps: number;
  reviewerFeeReserve: Prisma.Decimal;
  reviewWindowHours: number;
  status: string;
  proofSubmittedAt: Date | null;
  scheduleId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function formatOrder(order: OrderShape) {
  return {
    ...order,
    amount: order.amount.toString(),
    reviewerFeeReserve: order.reviewerFeeReserve.toString()
  };
}

export class OrdersService {
  private readonly hcsAuditService = new HcsAuditService();
  private readonly taskPolicyService = new TaskPolicyService();

  async createOrder(input: CreateOrderInput) {
    if (input.reviewWindowHours !== undefined) {
      if (!Number.isInteger(input.reviewWindowHours) || input.reviewWindowHours < 0) {
        throw new AppError("reviewWindowHours must be an integer >= 0", 400);
      }
    }

    const policyEvaluation = this.taskPolicyService.evaluate({
      title: input.title,
      objective: input.objective,
      instructions: input.instructions
    });

    if (policyEvaluation.decision === "REJECTED") {
      throw new AppError(
        `Task rejected by policy: ${policyEvaluation.reasons.join(", ")}`,
        403
      );
    }

    if (policyEvaluation.decision === "MANUAL_REVIEW") {
      throw new AppError(
        `Task requires manual review before booking: ${policyEvaluation.reasons.join(", ")}`,
        409
      );
    }

    const worker = await prisma.workerProfile.findUnique({
      where: { id: input.workerId }
    });

    if (!worker || worker.isBanned || worker.isSuspended) {
      throw new AppError("Worker is not bookable", 400);
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          clientId: input.clientId,
          clientAccountId: input.clientAccountId,
          workerId: input.workerId,
          title: input.title,
          objective: input.objective,
          instructions: input.instructions,
          locationContext: input.locationContext,
          deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : undefined,
          expectedDurationMinutes: input.expectedDurationMinutes,
          requiredProofSchema: input.requiredProofSchema,
          acceptanceCriteria: input.acceptanceCriteria,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency ?? "HBAR",
          platformFeeBps: input.platformFeeBps ?? 0,
          reviewerFeeReserve: new Prisma.Decimal(input.reviewerFeeReserve ?? "0"),
          reviewWindowHours: input.reviewWindowHours ?? 72,
          status: "DRAFT"
        }
      });

      return this.transitionOrderStateInTx(tx, created.id, "PAYMENT_PENDING");
    });

    await this.hcsAuditService.publishEvent({
      eventType: "order.created",
      orderId: order.id,
      actorId: input.clientId,
      payload: {
        amount: order.amount.toString(),
        currency: order.currency,
        policyDecision: policyEvaluation.decision,
        policyReasons: policyEvaluation.reasons
      }
    });

    return {
      ...formatOrder(order),
      policyDecision: policyEvaluation.decision,
      policyReasons: policyEvaluation.reasons
    };
  }

  async getOrderById(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    return formatOrder(order);
  }

  async startOrder(orderId: string) {
    const order = await prisma.$transaction((tx) =>
      this.transitionOrderStateInTx(tx, orderId, "IN_PROGRESS")
    );

    await this.hcsAuditService.publishEvent({
      eventType: "order.started",
      orderId: order.id
    });

    return formatOrder(order);
  }

  async transitionOrderState(orderId: string, nextStatus: OrderStatus) {
    const order = await prisma.$transaction((tx) =>
      this.transitionOrderStateInTx(tx, orderId, nextStatus)
    );

    return formatOrder(order);
  }

  private async transitionOrderStateInTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    nextStatus: OrderStatus
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    try {
      assertTransition(order.status as OrderStatus, nextStatus);
    } catch {
      throw new AppError(
        `Invalid order transition: ${order.status} -> ${nextStatus}`,
        409
      );
    }

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus
      }
    });
  }
}
