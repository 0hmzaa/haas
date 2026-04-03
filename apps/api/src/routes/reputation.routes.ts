import { Router } from "express";
import { ReputationService } from "../services/reputation/reputation.service.js";

const router = Router();
const reputationService = new ReputationService();

router.get("/workers/:id", async (req, res, next) => {
  try {
    const reputation = await reputationService.getWorkerReputation(req.params.id);
    res.status(200).json(reputation);
  } catch (error) {
    next(error);
  }
});

router.get("/reviewers/:id", async (req, res, next) => {
  try {
    const reputation = await reputationService.getReviewerReputation(req.params.id);
    res.status(200).json(reputation);
  } catch (error) {
    next(error);
  }
});

export default router;
