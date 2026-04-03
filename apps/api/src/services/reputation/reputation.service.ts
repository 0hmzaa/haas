import { DisputeResolution } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";

function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export class ReputationService {
  async recordOrderOutcome(input: {
    orderId: string;
    approved: boolean;
    disputed: boolean;
    disputeOutcome?: DisputeResolution;
  }) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        worker: true
      }
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    await prisma.reputationRecord.create({
      data: {
        workerId: order.workerId,
        orderId: order.id,
        approved: input.approved,
        timely: true,
        disputed: input.disputed,
        disputeOutcome: input.disputeOutcome,
        deltaScore: input.approved ? 2 : -2
      }
    });

    const records = await prisma.reputationRecord.findMany({
      where: { workerId: order.workerId }
    });

    const completedJobs = records.length;
    const approvals = records.filter((record) => record.approved).length;
    const disputes = records.filter((record) => record.disputed).length;
    const disputeLosses = records.filter(
      (record) => record.disputeOutcome === "REFUND_CLIENT"
    ).length;

    const approvalRate = completedJobs > 0 ? approvals / completedJobs : 0;
    const disputeRate = completedJobs > 0 ? disputes / completedJobs : 0;
    const disputeLossRate = disputes > 0 ? disputeLosses / disputes : 0;

    const reputationScore = clampScore(
      50 + approvals * 2 - disputes * 1.5 - disputeLosses * 4
    );

    await prisma.workerProfile.update({
      where: { id: order.workerId },
      data: {
        completedJobs,
        approvalRate,
        disputeRate,
        disputeLossRate,
        reputationScore,
        reviewerEligible:
          completedJobs >= 5 && approvalRate >= 0.8 && disputeLossRate <= 0.2
      }
    });
  }

  async updateReviewerReputationForDispute(disputeCaseId: string) {
    const dispute = await prisma.disputeCase.findUnique({
      where: { id: disputeCaseId },
      include: {
        votes: true
      }
    });

    if (!dispute || !dispute.resolution) {
      return;
    }

    for (const vote of dispute.votes) {
      const existing = await prisma.reviewerReputation.findUnique({
        where: { reviewerId: vote.reviewerId }
      });

      const previousCompleted = existing?.reviewsCompleted ?? 0;
      const previousAlignment = existing?.majorityAlignmentRate ?? 0;
      const aligned = vote.vote === dispute.resolution ? 1 : 0;

      const reviewsCompleted = previousCompleted + 1;
      const majorityAlignmentRate =
        (previousAlignment * previousCompleted + aligned) / reviewsCompleted;
      const trustScore = clampScore(majorityAlignmentRate * 100);

      await prisma.reviewerReputation.upsert({
        where: { reviewerId: vote.reviewerId },
        update: {
          reviewsCompleted,
          majorityAlignmentRate,
          reviewSpeedScore: 1,
          consistencyScore: majorityAlignmentRate,
          trustScore
        },
        create: {
          reviewerId: vote.reviewerId,
          reviewsCompleted,
          majorityAlignmentRate,
          reviewSpeedScore: 1,
          consistencyScore: majorityAlignmentRate,
          trustScore
        }
      });
    }
  }

  async getWorkerReputation(workerId: string) {
    const worker = await prisma.workerProfile.findUnique({
      where: { id: workerId }
    });

    if (!worker) {
      throw new AppError("Worker not found", 404);
    }

    return {
      workerId: worker.id,
      completedJobs: worker.completedJobs,
      approvalRate: worker.approvalRate,
      disputeRate: worker.disputeRate,
      disputeLossRate: worker.disputeLossRate,
      reputationScore: worker.reputationScore,
      reviewerEligible: worker.reviewerEligible
    };
  }

  async getReviewerReputation(reviewerId: string) {
    const reputation = await prisma.reviewerReputation.findUnique({
      where: { reviewerId }
    });

    if (!reputation) {
      return {
        reviewerId,
        reviewsCompleted: 0,
        majorityAlignmentRate: 0,
        reviewSpeedScore: 0,
        abuseReports: 0,
        consistencyScore: 0,
        trustScore: 0
      };
    }

    return {
      reviewerId: reputation.reviewerId,
      reviewsCompleted: reputation.reviewsCompleted,
      majorityAlignmentRate: reputation.majorityAlignmentRate,
      reviewSpeedScore: reputation.reviewSpeedScore,
      abuseReports: reputation.abuseReports,
      consistencyScore: reputation.consistencyScore,
      trustScore: reputation.trustScore
    };
  }
}
