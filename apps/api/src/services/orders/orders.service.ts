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

export type ListOrdersQuery = {
  workerId?: string;
  clientId?: string;
  clientAccountId?: string;
  reviewerId?: string;
  status?: OrderStatus;
  limit: number;
  offset: number;
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

function formatOrderWithRelations(order: Prisma.OrderGetPayload<{
  include: {
    funding: true;
    disputeCase: true;
  };
}>) {
  return {
    ...formatOrder(order),
    funding: order.funding
      ? {
          status: order.funding.status,
          x402PaymentId: order.funding.x402PaymentId,
          hederaTxId: order.funding.hederaTxId,
          payerAccount: order.funding.payerAccount,
          fundedAt: order.funding.fundedAt
        }
      : null,
    dispute: order.disputeCase
      ? {
          id: order.disputeCase.id,
          status: order.disputeCase.status,
          resolution: order.disputeCase.resolution,
          assignedReviewerIds: order.disputeCase.assignedReviewerIds
        }
      : null
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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        funding: true,
        disputeCase: true
      }
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    return formatOrderWithRelations(order);
  }

  async listOrders(query: ListOrdersQuery) {
    let reviewerOrderIds: string[] | undefined;
    if (query.reviewerId) {
      const disputes = await prisma.disputeCase.findMany({
        where: {
          assignedReviewerIds: {
            array_contains: [query.reviewerId]
          } as Prisma.JsonNullableFilter
        },
        select: {
          orderId: true
        }
      });

      reviewerOrderIds = disputes.map((dispute) => dispute.orderId);
      if (reviewerOrderIds.length === 0) {
        return [];
      }
    }

    const where: Prisma.OrderWhereInput = {
      workerId: query.workerId,
      clientId: query.clientId,
      clientAccountId: query.clientAccountId,
      status: query.status,
      id: reviewerOrderIds ? { in: reviewerOrderIds } : undefined
    };

    const orders = await prisma.order.findMany({
      where,
      include: {
        funding: true,
        disputeCase: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: query.limit,
      skip: query.offset
    });

    return orders.map((order) => formatOrderWithRelations(order));
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
