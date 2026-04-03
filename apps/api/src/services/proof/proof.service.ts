import { Prisma } from "@prisma/client";
import { assertTransition, type OrderStatus } from "@haas/shared/order";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { HcsAuditService } from "../hedera/hcs-audit.service.js";

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

function getProofStorageRoot(): string {
  const configured = process.env.PROOF_STORAGE_ROOT;

  if (configured && path.isAbsolute(configured)) {
    return configured;
  }

  return path.resolve(process.cwd(), "../../storage/proofs");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export class ProofService {
  private readonly hcsAuditService = new HcsAuditService();

  async submitProof(input: SubmitProofInput) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId } });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.status !== "IN_PROGRESS") {
      throw new AppError("Proof can only be submitted for IN_PROGRESS orders", 409);
    }

    const storageRoot = getProofStorageRoot();
    const orderDir = path.join(storageRoot, input.orderId);
    await mkdir(orderDir, { recursive: true });

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
      } catch {
        throw new AppError(
          `Invalid order transition: ${currentOrder.status} -> PROOF_SUBMITTED`,
          409
        );
      }

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

      await tx.order.update({
        where: { id: currentOrder.id },
        data: {
          status: "PROOF_SUBMITTED"
        }
      });

      return proof;
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

    return {
      id: result.id,
      orderId: result.orderId,
      originalName: result.originalName,
      mimeType: result.mimeType,
      localPath: result.localPath,
      fileSize: result.fileSize.toString(),
      sha256Hash: result.sha256Hash,
      uploadedAt: result.uploadedAt
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
