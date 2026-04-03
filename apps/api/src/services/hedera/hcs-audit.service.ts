import { HcsEventType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { HederaRuntimeService } from "./hedera-runtime.service.js";

export type HcsLifecycleEvent =
  | "order.created"
  | "order.funded"
  | "order.started"
  | "proof.submitted"
  | "review.window.started"
  | "order.approved"
  | "order.disputed"
  | "reviewer.vote.submitted"
  | "order.resolved"
  | "order.auto_released"
  | "order.refunded";

const EVENT_TYPE_MAP: Record<HcsLifecycleEvent, HcsEventType> = {
  "order.created": "order_created",
  "order.funded": "order_funded",
  "order.started": "order_started",
  "proof.submitted": "proof_submitted",
  "review.window.started": "review_window_started",
  "order.approved": "order_approved",
  "order.disputed": "order_disputed",
  "reviewer.vote.submitted": "reviewer_vote_submitted",
  "order.resolved": "order_resolved",
  "order.auto_released": "order_auto_released",
  "order.refunded": "order_refunded"
};

export type PublishHcsEventInput = {
  eventType: HcsLifecycleEvent;
  orderId: string;
  actorId?: string;
  proofHash?: string;
  storageRef?: string;
  resolution?: "RELEASE_TO_WORKER" | "REFUND_CLIENT" | "SPLIT_PAYMENT";
  txId?: string;
  nonce?: string;
  payload?: Record<string, unknown>;
};

export class HcsAuditService {
  private readonly hederaRuntime = new HederaRuntimeService();

  async publishEvent(input: PublishHcsEventInput) {
    const compactMessage = {
      eventType: input.eventType,
      orderId: input.orderId,
      actorId: input.actorId,
      timestamp: new Date().toISOString(),
      proofHash: input.proofHash,
      storageRef: input.storageRef,
      resolution: input.resolution,
      txId: input.txId,
      nonce: input.nonce ?? randomUUID()
    };

    const hcsSubmit = await this.hederaRuntime.submitHcsMessage(compactMessage);

    const payload = input.payload
      ? {
          ...input.payload,
          hcsTopicId: hcsSubmit?.topicId ?? null,
          hcsSubmissionTxId: hcsSubmit?.txId ?? null
        }
      : {
          hcsTopicId: hcsSubmit?.topicId ?? null,
          hcsSubmissionTxId: hcsSubmit?.txId ?? null
        };

    return prisma.hcsEvent.create({
      data: {
        orderId: input.orderId,
        eventType: EVENT_TYPE_MAP[input.eventType],
        actorId: input.actorId,
        proofHash: input.proofHash,
        storageRef: input.storageRef,
        resolution: input.resolution,
        txId: input.txId ?? hcsSubmit?.txId,
        nonce: compactMessage.nonce,
        payload
      }
    });
  }
}
