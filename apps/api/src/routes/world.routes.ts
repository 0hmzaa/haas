import { Router } from "express";
import { signRequest } from "@worldcoin/idkit-core/signing";
import { AppError } from "../lib/app-error.js";
import { WorldService } from "../services/world/world.service.js";
import {
  isRecord,
  readString,
  type WorldVerificationAdapter
} from "../services/world/world.adapter.js";
import { MockWorldVerificationAdapter } from "../services/world/world.mock.adapter.js";
import { HttpWorldVerificationAdapter } from "../services/world/world.http.adapter.js";
import { getWorldConfig } from "../config/world.config.js";

const router = Router();

function createWorldVerificationAdapter(): WorldVerificationAdapter {
  const config = getWorldConfig();

  if (config.mode === "live") {
    return new HttpWorldVerificationAdapter();
  }

  return new MockWorldVerificationAdapter();
}

const worldService = new WorldService(createWorldVerificationAdapter());

function extractProofPayload(body: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(body.result)) {
    return body.result;
  }

  if (isRecord(body.proof)) {
    return body.proof;
  }

  if ("proof" in body) {
    return { proof: body.proof };
  }

  if (typeof body.protocol_version === "string" || Array.isArray(body.responses)) {
    const payload = { ...body };
    delete payload.walletAddress;
    delete payload.session_id;
    delete payload.sessionId;
    delete payload.nullifier_hash;
    delete payload.nullifierHash;
    delete payload.proof;
    delete payload.result;
    return payload;
  }

  throw new AppError("World proof payload is required", 400);
}

router.get("/identity", async (req, res, next) => {
  try {
    const walletAddress = req.query.walletAddress;
    if (typeof walletAddress !== "string" || walletAddress.length === 0) {
      throw new AppError("walletAddress query parameter is required", 400);
    }

    const identity = await worldService.getIdentityByWallet(walletAddress);
    res.status(200).json(identity);
  } catch (error) {
    next(error);
  }
});

router.get("/rp-signature", async (_req, res, next) => {
  try {
    const config = getWorldConfig();

    if (config.mode !== "live") {
      res.status(200).json({ mode: "mock" as const });
      return;
    }

    if (!config.appId) {
      throw new AppError("WORLD_ID_APP_ID is required in WORLD_ID_MODE=live", 500);
    }

    if (!config.rpId || !config.rpSigningKey) {
      throw new AppError(
        "WORLD_ID_RP_ID and WORLD_ID_RP_SIGNING_KEY are required in WORLD_ID_MODE=live",
        500
      );
    }

    if (config.workerOnboardingAction.length === 0) {
      throw new AppError("WORLD_ID_ACTION_WORKER_ONBOARDING cannot be empty", 500);
    }

    const signature = signRequest({
      signingKeyHex: config.rpSigningKey,
      action: config.workerOnboardingAction,
      ttl: config.signatureTtlSeconds
    });

    res.status(200).json({
      mode: "live" as const,
      appId: config.appId,
      action: config.workerOnboardingAction,
      allowLegacyProofs: false,
      rpContext: {
        rp_id: config.rpId,
        nonce: signature.nonce,
        created_at: signature.createdAt,
        expires_at: signature.expiresAt,
        signature: signature.sig
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    if (!isRecord(req.body)) {
      throw new AppError("World verification payload must be a JSON object", 400);
    }
    const body = req.body;

    const sessionId = readString(body, "session_id", "sessionId");
    const nullifierHash = readString(body, "nullifier_hash", "nullifierHash");
    const walletAddress = readString(body, "walletAddress");
    const proofPayload = extractProofPayload(body);

    const result = await worldService.verifyAndUpsert({
      proofPayload,
      sessionId,
      nullifierHash,
      walletAddress
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
