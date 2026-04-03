import { Router } from "express";
import { AppError } from "../lib/app-error.js";
import { PaymentsService } from "../services/payments/payments.service.js";
import { X402FacilitatorVerifierService } from "../services/payments/x402-facilitator-verifier.service.js";

const router = Router();
const paymentsService = new PaymentsService();
const x402FacilitatorVerifierService = new X402FacilitatorVerifierService();

router.post("/webhooks/x402", async (req, res, next) => {
  try {
    if (typeof req.body?.success !== "boolean") {
      throw new AppError("success boolean is required", 400);
    }

    const webhookInput = {
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
    };

    const signatureVerification =
      x402FacilitatorVerifierService.verifyFundingWebhookSignature({
        webhook: webhookInput,
        signature:
          typeof req.headers["x-x402-signature"] === "string"
            ? req.headers["x-x402-signature"]
            : undefined,
        timestamp:
          typeof req.headers["x-x402-timestamp"] === "string"
            ? req.headers["x-x402-timestamp"]
            : undefined,
        facilitatorId:
          typeof req.headers["x-x402-facilitator-id"] === "string"
            ? req.headers["x-x402-facilitator-id"]
            : webhookInput.facilitatorId
      });

    const response = await paymentsService.processFundingWebhook({
      ...webhookInput,
      facilitatorId: signatureVerification.facilitatorId
    });

    res.status(200).json({
      ...response,
      signatureVerified: signatureVerification.signatureVerified
    });
  } catch (error) {
    next(error);
  }
});

export default router;
