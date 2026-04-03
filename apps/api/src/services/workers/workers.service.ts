import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";

export type WorkerListQuery = {
  country?: string;
  city?: string;
  availabilityStatus?: string;
  minRating?: number;
  skill?: string;
  limit: number;
  offset: number;
};

export type CreateWorkerInput = {
  verifiedHumanId: string;
  displayName: string;
  bio?: string;
  country?: string;
  city?: string;
  timezone?: string;
  languages?: string[];
  skills?: string[];
  availabilityStatus?: string;
  baseRate: string;
  acceptedProofTypes?: string[];
};

export type UpdateWorkerInput = Omit<CreateWorkerInput, "verifiedHumanId" | "displayName" | "baseRate"> & {
  displayName?: string;
  baseRate?: string;
  reviewerEligible?: boolean;
};

function formatWorker(worker: {
  id: string;
  verifiedHumanId: string;
  displayName: string;
  bio: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  languages: Prisma.JsonValue | null;
  skills: Prisma.JsonValue | null;
  availabilityStatus: string;
  baseRate: Prisma.Decimal;
  acceptedProofTypes: Prisma.JsonValue | null;
  ratingAvg: number;
  completedJobs: number;
  approvalRate: number;
  disputeRate: number;
  disputeLossRate: number;
  reputationScore: number;
  reviewerEligible: boolean;
  isSuspended: boolean;
  isBanned: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...worker,
    baseRate: worker.baseRate.toString()
  };
}

export class WorkersService {
  async createWorker(input: CreateWorkerInput) {
    const human = await prisma.verifiedHuman.findUnique({
      where: { id: input.verifiedHumanId }
    });

    if (!human || !human.worldVerified) {
      throw new AppError("verifiedHumanId must reference a World-verified human", 400);
    }

    const worker = await prisma.workerProfile.create({
      data: {
        verifiedHumanId: input.verifiedHumanId,
        displayName: input.displayName,
        bio: input.bio,
        country: input.country,
        city: input.city,
        timezone: input.timezone,
        languages: input.languages,
        skills: input.skills,
        availabilityStatus: input.availabilityStatus ?? "AVAILABLE",
        baseRate: new Prisma.Decimal(input.baseRate),
        acceptedProofTypes: input.acceptedProofTypes
      }
    });

    return formatWorker(worker);
  }

  async updateWorker(workerId: string, input: UpdateWorkerInput) {
    const worker = await prisma.workerProfile.update({
      where: { id: workerId },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        country: input.country,
        city: input.city,
        timezone: input.timezone,
        languages: input.languages,
        skills: input.skills,
        availabilityStatus: input.availabilityStatus,
        baseRate: input.baseRate ? new Prisma.Decimal(input.baseRate) : undefined,
        acceptedProofTypes: input.acceptedProofTypes,
        reviewerEligible: input.reviewerEligible
      }
    });

    return formatWorker(worker);
  }

  async getWorkerById(workerId: string) {
    const worker = await prisma.workerProfile.findUnique({
      where: { id: workerId }
    });

    if (!worker) {
      throw new AppError("Worker not found", 404);
    }

    return formatWorker(worker);
  }

  async listWorkers(query: WorkerListQuery) {
    const where: Prisma.WorkerProfileWhereInput = {
      country: query.country,
      city: query.city,
      availabilityStatus: query.availabilityStatus,
      ratingAvg: query.minRating ? { gte: query.minRating } : undefined
    };

    if (query.skill) {
      where.skills = {
        array_contains: [query.skill]
      } as Prisma.JsonNullableFilter;
    }

    const workers = await prisma.workerProfile.findMany({
      where,
      orderBy: [
        {
          reputationScore: "desc"
        },
        {
          completedJobs: "desc"
        }
      ],
      take: query.limit,
      skip: query.offset
    });

    return workers.map((worker) => formatWorker(worker));
  }
}
