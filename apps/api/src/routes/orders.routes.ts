import { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { AppError } from "../lib/app-error.js";
import { OrdersService } from "../services/orders/orders.service.js";
import { PaymentsService } from "../services/payments/payments.service.js";
import { ProofService } from "../services/proof/proof.service.js";
import { SettlementService } from "../services/settlement/settlement.service.js";

const router = Router();
const ordersService = new OrdersService();
const paymentsService = new PaymentsService();
const proofService = new ProofService();
const settlementService = new SettlementService();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024
  }
});

function parseJsonField(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "object") {
    return value as Prisma.InputJsonValue;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Prisma.InputJsonValue;
    } catch {
      throw new AppError("Invalid JSON field in proof payload", 400);
    }
  }

  return undefined;
}

router.post("/", async (req, res, next) => {
  try {
    if (typeof req.body?.clientId !== "string" || req.body.clientId.length === 0) {
      throw new AppError("clientId is required", 400);
    }

    if (typeof req.body?.workerId !== "string" || req.body.workerId.length === 0) {
      throw new AppError("workerId is required", 400);
    }

    if (typeof req.body?.title !== "string" || req.body.title.length === 0) {
      throw new AppError("title is required", 400);
    }

    if (typeof req.body?.objective !== "string" || req.body.objective.length === 0) {
      throw new AppError("objective is required", 400);
    }

    if (typeof req.body?.instructions !== "string" || req.body.instructions.length === 0) {
      throw new AppError("instructions is required", 400);
    }

    if (typeof req.body?.amount !== "string" || req.body.amount.length === 0) {
      throw new AppError("amount is required as a decimal string", 400);
    }

    const order = await ordersService.createOrder({
      clientId: req.body.clientId,
      workerId: req.body.workerId,
      title: req.body.title,
      objective: req.body.objective,
      instructions: req.body.instructions,
      locationContext:
        typeof req.body.locationContext === "string" ? req.body.locationContext : undefined,
      deadlineAt: typeof req.body.deadlineAt === "string" ? req.body.deadlineAt : undefined,
      expectedDurationMinutes:
        typeof req.body.expectedDurationMinutes === "number"
          ? req.body.expectedDurationMinutes
          : undefined,
      requiredProofSchema:
        req.body.requiredProofSchema && typeof req.body.requiredProofSchema === "object"
          ? req.body.requiredProofSchema
          : undefined,
      acceptanceCriteria:
        req.body.acceptanceCriteria && typeof req.body.acceptanceCriteria === "object"
          ? req.body.acceptanceCriteria
          : undefined,
      amount: req.body.amount,
      currency: typeof req.body.currency === "string" ? req.body.currency : undefined,
      platformFeeBps:
        typeof req.body.platformFeeBps === "number" ? req.body.platformFeeBps : undefined,
      reviewerFeeReserve:
        typeof req.body.reviewerFeeReserve === "string"
          ? req.body.reviewerFeeReserve
          : undefined,
      reviewWindowHours:
        typeof req.body.reviewWindowHours === "number" ? req.body.reviewWindowHours : undefined
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const order = await ordersService.getOrderById(req.params.id);
    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/start", async (req, res, next) => {
  try {
    const order = await ordersService.startOrder(req.params.id);
    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/pay", async (req, res, next) => {
  try {
    const paymentRequirement = await paymentsService.createPaymentRequirement(
      req.params.id
    );
    res.status(200).json({
      status: "PAYMENT_REQUIRED",
      payment: paymentRequirement
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/proof", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("proof file is required", 400);
    }

    const result = await proofService.submitProof({
      orderId: req.params.id,
      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer
      },
      summary: typeof req.body?.summary === "string" ? req.body.summary : undefined,
      checklistJson: parseJsonField(req.body?.checklistJson),
      structuredJson: parseJsonField(req.body?.structuredJson),
      geoMetadata: parseJsonField(req.body?.geoMetadata),
      timeMetadata: parseJsonField(req.body?.timeMetadata),
      confidenceStatement:
        typeof req.body?.confidenceStatement === "string"
          ? req.body.confidenceStatement
          : undefined
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/proof", async (req, res, next) => {
  try {
    const proofs = await proofService.getProofs(req.params.id);
    res.status(200).json({ items: proofs, count: proofs.length });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/approve", async (req, res, next) => {
  try {
    const actorId =
      typeof req.body?.actorId === "string" ? req.body.actorId : undefined;
    const result = await settlementService.approveOrder(req.params.id, actorId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
