import { Router } from "express";
import { AppError } from "../lib/app-error.js";
import { OrdersService } from "../services/orders/orders.service.js";
import { PaymentsService } from "../services/payments/payments.service.js";

const router = Router();
const ordersService = new OrdersService();
const paymentsService = new PaymentsService();

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

export default router;
