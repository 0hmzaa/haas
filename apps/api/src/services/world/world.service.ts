import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import type { WorldVerificationAdapter } from "./world.adapter.js";

export type VerifyWorldRequest = {
  proof: unknown;
  sessionId: string;
  nullifierHash: string;
  walletAddress?: string;
};

export type VerifyWorldResponse = {
  verifiedHumanId: string;
  worldSessionId: string;
  walletAddress: string | null;
  worldVerified: boolean;
};

export class WorldService {
  constructor(private readonly adapter: WorldVerificationAdapter) {}

  async verifyAndUpsert(input: VerifyWorldRequest): Promise<VerifyWorldResponse> {
    const verified = await this.adapter.verify({
      proof: input.proof,
      sessionId: input.sessionId,
      nullifierHash: input.nullifierHash
    });

    if (!verified.isValid) {
      throw new AppError("World verification failed", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingNullifier = await tx.worldNullifier.findUnique({
        where: { nullifier: verified.nullifierHash }
      });

      if (existingNullifier) {
        throw new AppError("Nullifier already used", 409);
      }

      const existingHuman = await tx.verifiedHuman.findUnique({
        where: { worldSessionId: verified.sessionId }
      });

      const verifiedHuman = existingHuman
        ? await tx.verifiedHuman.update({
            where: { id: existingHuman.id },
            data: {
              worldVerified: true,
              walletAddress: input.walletAddress ?? existingHuman.walletAddress
            }
          })
        : await tx.verifiedHuman.create({
            data: {
              worldSessionId: verified.sessionId,
              walletAddress: input.walletAddress,
              worldVerified: true
            }
          });

      await tx.worldNullifier.create({
        data: {
          nullifier: verified.nullifierHash,
          verifiedHumanId: verifiedHuman.id
        }
      });

      return verifiedHuman;
    });

    return {
      verifiedHumanId: result.id,
      worldSessionId: result.worldSessionId,
      walletAddress: result.walletAddress,
      worldVerified: result.worldVerified
    };
  }
}
