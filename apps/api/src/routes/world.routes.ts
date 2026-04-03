import { Router } from "express";
import { AppError } from "../lib/app-error.js";
import { WorldService } from "../services/world/world.service.js";
import type { WorldVerificationAdapter } from "../services/world/world.adapter.js";
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

router.post("/verify", async (req, res, next) => {
  try {
    const sessionId = req.body?.session_id;
    const nullifierHash = req.body?.nullifier_hash;

    if (typeof sessionId !== "string" || sessionId.length === 0) {
      throw new AppError("session_id is required", 400);
    }

    if (typeof nullifierHash !== "string" || nullifierHash.length === 0) {
      throw new AppError("nullifier_hash is required", 400);
    }

    const walletAddress =
      typeof req.body?.walletAddress === "string"
        ? req.body.walletAddress
        : undefined;

    const result = await worldService.verifyAndUpsert({
      proof: req.body?.proof,
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
