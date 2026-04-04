import { Prisma } from "@prisma/client";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { HcsAuditService } from "../hedera/hcs-audit.service.js";
import { ScheduledReleaseService } from "../hedera/scheduled-release.service.js";

export type SubmitProofInput = {
  orderId: string;
  file: {
    originalName: string;
    mimeType: string;
    size: number;
    buffer: Buffer;
  };
  summary?: string;
  checklistJson?: Prisma.InputJsonValue;
  structuredJson?: Prisma.InputJsonValue;
  geoMetadata?: Prisma.InputJsonValue;
  timeMetadata?: Prisma.InputJsonValue;
  confidenceStatement?: string;
};

const STORAGE_FALLBACK_ERROR_CODES = new Set(["EACCES", "EPERM", "ENOENT"]);

function getDefaultProofStorageRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), "storage/proofs"),
    path.resolve(process.cwd(), "../../storage/proofs")
  ];

  const existingParentCandidate = candidates.find((candidate) =>
    existsSync(path.dirname(candidate))
  );

  return existingParentCandidate ?? candidates[0];
}

function getProofStorageRoot(): string {
  const configured = process.env.PROOF_STORAGE_ROOT;

  if (configured && configured.length > 0) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }

  return getDefaultProofStorageRoot();
}

function shouldFallbackToDefaultStorage(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && STORAGE_FALLBACK_ERROR_CODES.has(code);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export class ProofService {
  private readonly hcsAuditService = new HcsAuditService();
  private readonly scheduledReleaseService = new ScheduledReleaseService();

  async submitProof(input: SubmitProofInput) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId } });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.status !== "IN_PROGRESS") {
      throw new AppError("Proof can only be submitted for IN_PROGRESS orders", 409);
    }

    // Every timeout schedule must be cancellable, which requires an admin key.
    this.scheduledReleaseService.ensureAdminKeyConfigured();

    let storageRoot = getProofStorageRoot();
    let orderDir = path.join(storageRoot, input.orderId);

    try {
      await mkdir(orderDir, { recursive: true });
    } catch (error) {
      if (!path.isAbsolute(storageRoot) || !shouldFallbackToDefaultStorage(error)) {
        throw error;
      }

      storageRoot = getDefaultProofStorageRoot();
      orderDir = path.join(storageRoot, input.orderId);
      await mkdir(orderDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${randomUUID()}-${sanitizeFilename(input.file.originalName)}`;
    const localPath = path.join(orderDir, fileName);

    await writeFile(localPath, input.file.buffer);

    const sha256Hash = createHash("sha256").update(input.file.buffer).digest("hex");

    const result = await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({ where: { id: input.orderId } });

      if (!currentOrder) {
        throw new AppError("Order not found", 404);
      }

      try {
        assertTransition(currentOrder.status as OrderStatus, "PROOF_SUBMITTED");
        assertTransition("PROOF_SUBMITTED", "REVIEW_WINDOW");
      } catch {
        throw new AppError(
          `Invalid order transition: ${currentOrder.status} -> PROOF_SUBMITTED -> REVIEW_WINDOW`,
          409
        );
      }

      const proofSubmittedAt = new Date();

      const proof = await tx.proofArtifact.create({
        data: {
          orderId: input.orderId,
          originalName: input.file.originalName,
          mimeType: input.file.mimeType,
          localPath,
          fileSize: BigInt(input.file.size),
          sha256Hash,
          summary: input.summary,
          checklistJson: input.checklistJson,
          structuredJson: input.structuredJson,
          geoMetadata: input.geoMetadata,
          timeMetadata: input.timeMetadata,
          confidenceStatement: input.confidenceStatement
        }
      });

      const updatedOrder = await tx.order.update({
        where: { id: currentOrder.id },
        data: {
          status: "REVIEW_WINDOW",
          proofSubmittedAt
        }
      });

      return {
        proof,
        proofSubmittedAt,
        reviewWindowHours: updatedOrder.reviewWindowHours
      };
    });

    const schedule = await this.scheduledReleaseService.createAutoReleaseSchedule({
      orderId: input.orderId,
      proofSubmittedAt: result.proofSubmittedAt,
      reviewWindowHours: result.reviewWindowHours
    });

    await this.hcsAuditService.publishEvent({
      eventType: "proof.submitted",
      orderId: input.orderId,
      proofHash: sha256Hash,
      storageRef: localPath,
      payload: {
        mimeType: input.file.mimeType,
        fileSize: input.file.size
      }
    });

    await this.hcsAuditService.publishEvent({
      eventType: "review.window.started",
      orderId: input.orderId,
      payload: {
        proofSubmittedAt: result.proofSubmittedAt.toISOString(),
        reviewWindowHours: result.reviewWindowHours,
        scheduleId: schedule.scheduleId,
        scheduleCreateTxId: schedule.scheduleCreateTxId,
        autoReleaseAt: schedule.releaseAt.toISOString()
      }
    });

    return {
      id: result.proof.id,
      orderId: result.proof.orderId,
      originalName: result.proof.originalName,
      mimeType: result.proof.mimeType,
      localPath: result.proof.localPath,
      fileSize: result.proof.fileSize.toString(),
      sha256Hash: result.proof.sha256Hash,
      uploadedAt: result.proof.uploadedAt,
      reviewWindow: {
        proofSubmittedAt: result.proofSubmittedAt,
        reviewWindowHours: result.reviewWindowHours,
        scheduleId: schedule.scheduleId,
        autoReleaseAt: schedule.releaseAt
      }
    };
  }

  async getProofs(orderId: string) {
    const proofs = await prisma.proofArtifact.findMany({
      where: { orderId },
      orderBy: { uploadedAt: "desc" }
    });

    return proofs.map((proof) => ({
      id: proof.id,
      orderId: proof.orderId,
      originalName: proof.originalName,
      mimeType: proof.mimeType,
      localPath: proof.localPath,
      fileSize: proof.fileSize.toString(),
      sha256Hash: proof.sha256Hash,
      uploadedAt: proof.uploadedAt
    }));
  }
}
