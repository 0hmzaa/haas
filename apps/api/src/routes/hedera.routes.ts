import { Router } from "express";
import { AppError } from "../lib/app-error.js";
import {
  ReconciliationService,
  type HederaWebhookPayload
} from "../services/hedera/reconciliation.service.js";

const router = Router();
const reconciliationService = new ReconciliationService();
const HEDERA_TX_TYPES = [
  "FUNDING",
  "RELEASE",
  "REFUND",
  "PROOF_EVENT",
  "DISPUTE_EVENT"
] as const;

router.post("/webhooks/hedera", async (req, res, next) => {
  try {
    if (typeof req.body?.orderId !== "string" || req.body.orderId.length === 0) {
      throw new AppError("orderId is required", 400);
    }

    if (
      typeof req.body?.txType !== "string" ||
      !HEDERA_TX_TYPES.includes(req.body.txType as (typeof HEDERA_TX_TYPES)[number])
    ) {
      throw new AppError(
        "txType must be FUNDING, RELEASE, REFUND, PROOF_EVENT, or DISPUTE_EVENT",
        400
      );
    }

    if (typeof req.body?.txId !== "string" || req.body.txId.length === 0) {
      throw new AppError("txId is required", 400);
    }

    if (req.body.status !== "SUCCESS" && req.body.status !== "FAILED") {
      throw new AppError("status must be SUCCESS or FAILED", 400);
    }

    const payload: HederaWebhookPayload = {
      orderId: req.body.orderId,
      txType: req.body.txType as HederaWebhookPayload["txType"],
      txId: req.body.txId,
      status: req.body.status,
      topicId: typeof req.body.topicId === "string" ? req.body.topicId : undefined,
      sequence: typeof req.body.sequence === "string" ? req.body.sequence : undefined
    };

    const result = await reconciliationService.processHederaWebhook(payload);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
