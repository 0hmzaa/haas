import { Router } from "express";
import { AppError } from "../lib/app-error.js";
import { PaymentsService } from "../services/payments/payments.service.js";

const router = Router();
const paymentsService = new PaymentsService();

router.post("/webhooks/x402", async (req, res, next) => {
  try {
    if (typeof req.body?.success !== "boolean") {
      throw new AppError("success boolean is required", 400);
    }

    const response = await paymentsService.processFundingWebhook({
      x402PaymentId:
        typeof req.body?.x402PaymentId === "string" ? req.body.x402PaymentId : undefined,
      orderId: typeof req.body?.orderId === "string" ? req.body.orderId : undefined,
      success: req.body.success,
      hederaTxId: typeof req.body?.hederaTxId === "string" ? req.body.hederaTxId : undefined,
      facilitatorId:
        typeof req.body?.facilitatorId === "string" ? req.body.facilitatorId : undefined,
      payerAccount:
        typeof req.body?.payerAccount === "string" ? req.body.payerAccount : undefined,
      amount: typeof req.body?.amount === "string" ? req.body.amount : undefined,
      asset: typeof req.body?.asset === "string" ? req.body.asset : undefined
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
