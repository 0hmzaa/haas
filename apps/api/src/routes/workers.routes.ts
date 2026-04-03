import { Prisma } from "@prisma/client";
import { Router } from "express";
import { AppError } from "../lib/app-error.js";
import { WorkersService } from "../services/workers/workers.service.js";

const router = Router();
const workersService = new WorkersService();

function parsePagination(value: unknown, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
}

router.get("/", async (req, res, next) => {
  try {
    const minRatingRaw = req.query.minRating;
    const minRating =
      typeof minRatingRaw === "string" ? Number.parseFloat(minRatingRaw) : undefined;

    const workers = await workersService.listWorkers({
      country: typeof req.query.country === "string" ? req.query.country : undefined,
      city: typeof req.query.city === "string" ? req.query.city : undefined,
      availabilityStatus:
        typeof req.query.availabilityStatus === "string"
          ? req.query.availabilityStatus
          : undefined,
      skill: typeof req.query.skill === "string" ? req.query.skill : undefined,
      minRating: Number.isFinite(minRating) ? minRating : undefined,
      limit: Math.min(parsePagination(req.query.limit, 20), 100),
      offset: parsePagination(req.query.offset, 0)
    });

    res.status(200).json({ items: workers, count: workers.length });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const worker = await workersService.getWorkerById(req.params.id);
    res.status(200).json(worker);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (typeof req.body?.verifiedHumanId !== "string" || req.body.verifiedHumanId.length === 0) {
      throw new AppError("verifiedHumanId is required", 400);
    }

    if (typeof req.body?.displayName !== "string" || req.body.displayName.length === 0) {
      throw new AppError("displayName is required", 400);
    }

    if (typeof req.body?.baseRate !== "string" || req.body.baseRate.length === 0) {
      throw new AppError("baseRate is required and must be a decimal string", 400);
    }

    const worker = await workersService.createWorker({
      verifiedHumanId: req.body.verifiedHumanId,
      displayName: req.body.displayName,
      bio: typeof req.body.bio === "string" ? req.body.bio : undefined,
      country: typeof req.body.country === "string" ? req.body.country : undefined,
      city: typeof req.body.city === "string" ? req.body.city : undefined,
      timezone: typeof req.body.timezone === "string" ? req.body.timezone : undefined,
      languages: Array.isArray(req.body.languages) ? req.body.languages : undefined,
      skills: Array.isArray(req.body.skills) ? req.body.skills : undefined,
      availabilityStatus:
        typeof req.body.availabilityStatus === "string"
          ? req.body.availabilityStatus
          : undefined,
      baseRate: req.body.baseRate,
      acceptedProofTypes: Array.isArray(req.body.acceptedProofTypes)
        ? req.body.acceptedProofTypes
        : undefined
    });

    res.status(201).json(worker);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const worker = await workersService.updateWorker(req.params.id, {
      displayName: typeof req.body?.displayName === "string" ? req.body.displayName : undefined,
      bio: typeof req.body?.bio === "string" ? req.body.bio : undefined,
      country: typeof req.body?.country === "string" ? req.body.country : undefined,
      city: typeof req.body?.city === "string" ? req.body.city : undefined,
      timezone: typeof req.body?.timezone === "string" ? req.body.timezone : undefined,
      languages: Array.isArray(req.body?.languages) ? req.body.languages : undefined,
      skills: Array.isArray(req.body?.skills) ? req.body.skills : undefined,
      availabilityStatus:
        typeof req.body?.availabilityStatus === "string"
          ? req.body.availabilityStatus
          : undefined,
      baseRate: typeof req.body?.baseRate === "string" ? req.body.baseRate : undefined,
      acceptedProofTypes: Array.isArray(req.body?.acceptedProofTypes)
        ? req.body.acceptedProofTypes
        : undefined,
      reviewerEligible:
        typeof req.body?.reviewerEligible === "boolean"
          ? req.body.reviewerEligible
          : undefined
    });

    res.status(200).json(worker);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      next(new AppError("Worker not found", 404));
      return;
    }

    next(error);
  }
});

export default router;
