import { HcsEventType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { isHederaAccountId } from "../../lib/hbar.js";
import { HcsAuditService } from "./hcs-audit.service.js";
import { ReputationService } from "../reputation/reputation.service.js";
import { getHederaConfig } from "../../config/hedera.config.js";
import { HederaRuntimeService } from "./hedera-runtime.service.js";

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

type MirrorTransactionRecord = {
  consensus_timestamp: string;
  name: string;
  result: string;
  transaction_id: string;
  entity_id?: string;
  memo_base64?: string;
  memo?: string;
  scheduled?: boolean;
};

type MirrorTransactionsResponse = {
  transactions?: MirrorTransactionRecord[];
};

type MirrorTopicMessageRecord = {
  consensus_timestamp: string;
  message: string;
  payer_account_id: string;
  running_hash: string;
  sequence_number: number;
};

type MirrorTopicMessagesResponse = {
  messages?: MirrorTopicMessageRecord[];
};

type MirrorLifecycleMessage = {
  eventType?: string;
  orderId?: string;
  txId?: string;
  nonce?: string;
  timestamp?: string;
};

type MirrorTransactionView = {
  txId: string;
  consensusTimestamp: string;
  result: string;
  name: string;
  entityId: string | null;
  memo: string;
  scheduled: boolean;
};

type MirrorTopicMessageView = {
  sequenceNumber: number;
  consensusTimestamp: string;
  payerAccountId: string;
  eventType: string | null;
  txId: string | null;
  nonce: string | null;
  messageTimestamp: string | null;
};

type ReviewWindowOrder = {
  id: string;
  status: OrderStatus;
  proofSubmittedAt: Date | null;
  reviewWindowHours: number;
  scheduleId: string | null;
  currency: string;
  amount: {
    toString(): string;
  };
  worker: {
    verifiedHuman: {
      walletAddress: string | null;
    };
  };
  hederaLedger: {
    scheduleId: string | null;
  } | null;
};

export type ReconcileExpiredReviewWindowsInput = {
  limit?: number;
};

export type ReconcileExpiredReviewWindowsResult = {
  scanned: number;
  eligible: number;
  reconciled: number;
  skipped: number;
  errors: Array<{
    orderId: string;
    reason: string;
  }>;
};

const LOCAL_SCHEDULE_PREFIX = "sched_local_";

function decodeMirrorMessage(messageBase64: string): MirrorLifecycleMessage | null {
  try {
    const decoded = Buffer.from(messageBase64, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as MirrorLifecycleMessage;
    return parsed;
  } catch {
    return null;
  }
}

function decodeMemoBase64(value: string | undefined): string {
  if (!value || value.length === 0) {
    return "";
  }

  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export class ReconciliationService {
  private readonly hcsAuditService = new HcsAuditService();
  private readonly reputationService = new ReputationService();
  private readonly hederaConfig = getHederaConfig();
  private readonly hederaRuntime = new HederaRuntimeService();

  private getEscrowOrOperatorAccountId(): string | null {
    return this.hederaConfig.defaultEscrowAccountId ?? this.hederaConfig.operatorAccountId ?? null;
  }

  private computeReviewWindowEndsAt(order: {
    proofSubmittedAt: Date | null;
    reviewWindowHours: number;
  }): Date | null {
    if (!order.proofSubmittedAt) {
      return null;
    }

    return new Date(
      order.proofSubmittedAt.getTime() + order.reviewWindowHours * 60 * 60 * 1000
    );
  }

  private getEffectiveScheduleId(order: {
    scheduleId: string | null;
    hederaLedger: { scheduleId: string | null } | null;
  }): string | null {
    return order.scheduleId ?? order.hederaLedger?.scheduleId ?? null;
  }

  private async executeFallbackReleaseTransfer(order: ReviewWindowOrder): Promise<string> {
    if (!this.hederaRuntime.isEnabled()) {
      return `auto_release_local_${randomUUID()}`;
    }

    if (order.currency !== "HBAR") {
      throw new AppError("Only HBAR auto-release transfers are supported", 409);
    }

    const workerAccountId = order.worker.verifiedHuman.walletAddress;
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
          amountHbar: order.amount.toString()
        }
      ],
      memo: `haas.order.${order.id}.auto-release.fallback`
    });

    if (!transfer) {
      throw new AppError("Failed to execute fallback auto-release transfer", 500);
    }

    return transfer.txId;
  }

  private async fetchMirrorJson<T>(path: string): Promise<T | null> {
    const baseUrl = this.hederaConfig.mirrorNodeBaseUrl.replace(/\/+$/, "");
    const url = `${baseUrl}${path}`;
    const fetchFn = globalThis.fetch;

    if (typeof fetchFn !== "function") {
      return null;
    }

    try {
      const response = await fetchFn(url, {
        headers: {
          accept: "application/json"
        }
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  private async lookupMirrorTransaction(txId: string): Promise<MirrorTransactionView | null> {
    const payload = await this.fetchMirrorJson<MirrorTransactionsResponse>(
      `/api/v1/transactions/${encodeURIComponent(txId)}`
    );
    const tx = payload?.transactions?.[0];

    if (!tx) {
      return null;
    }

    return {
      txId: tx.transaction_id,
      consensusTimestamp: tx.consensus_timestamp,
      result: tx.result,
      name: tx.name,
      entityId: tx.entity_id ?? null,
      memo: tx.memo ?? decodeMemoBase64(tx.memo_base64),
      scheduled: tx.scheduled === true
    };
  }

  private async lookupMirrorTopicMessages(
    topicId: string,
    orderId: string
  ): Promise<MirrorTopicMessageView[]> {
    const payload = await this.fetchMirrorJson<MirrorTopicMessagesResponse>(
      `/api/v1/topics/${encodeURIComponent(topicId)}/messages?limit=100&order=asc`
    );

    if (!payload?.messages) {
      return [];
    }

    return payload.messages
      .map((item) => {
        const lifecycle = decodeMirrorMessage(item.message);
        if (lifecycle?.orderId && lifecycle.orderId !== orderId) {
          return null;
        }

        return {
          sequenceNumber: item.sequence_number,
          consensusTimestamp: item.consensus_timestamp,
          payerAccountId: item.payer_account_id,
          eventType: lifecycle?.eventType ?? null,
          txId: lifecycle?.txId ?? null,
          nonce: lifecycle?.nonce ?? null,
          messageTimestamp: lifecycle?.timestamp ?? null
        };
      })
      .filter((item): item is MirrorTopicMessageView => item !== null);
  }

  private async lookupMirrorAutoReleaseTxId(orderId: string): Promise<string | null> {
    const escrowOrOperator = this.getEscrowOrOperatorAccountId();
    if (!escrowOrOperator || !isHederaAccountId(escrowOrOperator)) {
      return null;
    }

    const payload = await this.fetchMirrorJson<MirrorTransactionsResponse>(
      `/api/v1/transactions?account.id=${encodeURIComponent(escrowOrOperator)}&limit=100&order=desc`
    );

    if (!payload?.transactions) {
      return null;
    }

    const expectedMemos = new Set([
      `haas.order.${orderId}.auto-release`,
      `haas.order.${orderId}.auto-release.fallback`
    ]);

    const tx = payload.transactions.find((item) => {
      if (item.result !== "SUCCESS") {
        return false;
      }

      if (!item.name.includes("CRYPTO")) {
        return false;
      }

      const memo = item.memo ?? decodeMemoBase64(item.memo_base64);
      return expectedMemos.has(memo);
    });

    return tx?.transaction_id ?? null;
  }

  async reconcileExpiredReviewWindows(
    input: ReconcileExpiredReviewWindowsInput = {}
  ): Promise<ReconcileExpiredReviewWindowsResult> {
    const limit = Number.isInteger(input.limit) && input.limit && input.limit > 0 ? input.limit : 25;

    const orders = await prisma.order.findMany({
      where: {
        status: "REVIEW_WINDOW",
        proofSubmittedAt: {
          not: null
        }
      },
      include: {
        worker: {
          select: {
            verifiedHuman: {
              select: {
                walletAddress: true
              }
            }
          }
        },
        hederaLedger: {
          select: {
            scheduleId: true
          }
        }
      },
      orderBy: {
        proofSubmittedAt: "asc"
      },
      take: limit
    });

    let eligible = 0;
    let reconciled = 0;
    let skipped = 0;
    const errors: ReconcileExpiredReviewWindowsResult["errors"] = [];

    for (const order of orders as ReviewWindowOrder[]) {
      const reviewWindowEndsAt = this.computeReviewWindowEndsAt(order);
      if (!reviewWindowEndsAt || Date.now() < reviewWindowEndsAt.getTime()) {
        continue;
      }

      eligible += 1;

      try {
        const effectiveScheduleId = this.getEffectiveScheduleId(order);
        let txId: string | null = null;

        if (
          effectiveScheduleId &&
          !effectiveScheduleId.startsWith(LOCAL_SCHEDULE_PREFIX) &&
          this.hederaRuntime.isEnabled()
        ) {
          txId = await this.lookupMirrorAutoReleaseTxId(order.id);
          if (!txId) {
            skipped += 1;
            continue;
          }
        } else {
          txId = await this.executeFallbackReleaseTransfer(order);
        }

        if (!txId) {
          skipped += 1;
          continue;
        }

        await this.processHederaWebhook({
          orderId: order.id,
          txType: "RELEASE",
          txId,
          status: "SUCCESS"
        });

        reconciled += 1;
      } catch (error) {
        errors.push({
          orderId: order.id,
          reason: error instanceof Error ? error.message : "Unknown reconciliation error"
        });
      }
    }

    return {
      scanned: orders.length,
      eligible,
      reconciled,
      skipped,
      errors
    };
  }

  async processHederaWebhook(payload: HederaWebhookPayload) {
    const order = await prisma.order.findUnique({ where: { id: payload.orderId } });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    await prisma.hederaOrderLedger.upsert({
      where: { orderId: payload.orderId },
      update: {
        hederaNetwork: this.hederaConfig.network,
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
        hederaNetwork: this.hederaConfig.network,
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
            hederaNetwork: this.hederaConfig.network,
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

    const txIds = Array.from(
      new Set(
        [
          order.funding?.hederaTxId,
          order.hederaLedger?.fundingTxId,
          order.hederaLedger?.releaseTxId,
          order.hederaLedger?.refundTxId,
          ...order.hcsEvents.map((event) => event.txId)
        ].filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );

    const mirrorTransactions = (
      await Promise.all(txIds.map((txId) => this.lookupMirrorTransaction(txId)))
    ).filter((item): item is MirrorTransactionView => item !== null);

    const topicId = order.hederaLedger?.topicId ?? this.hederaConfig.hcsTopicId ?? null;
    const mirrorTopicMessages = topicId
      ? await this.lookupMirrorTopicMessages(topicId, orderId)
      : [];

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
      timeline,
      mirror: {
        baseUrl: this.hederaConfig.mirrorNodeBaseUrl,
        topicId,
        transactions: mirrorTransactions,
        topicMessages: mirrorTopicMessages
      }
    };
  }
}
