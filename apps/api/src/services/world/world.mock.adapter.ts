import type {
  WorldVerificationAdapter,
  WorldVerifyInput,
  WorldVerifyResult
} from "./world.adapter.js";
import {
  extractNullifierFromPayload as extractNullifier,
  extractSessionIdFromPayload as extractSessionId,
  isRecord as isRecordValue
} from "./world.adapter.js";

export class MockWorldVerificationAdapter implements WorldVerificationAdapter {
  async verify(input: WorldVerifyInput): Promise<WorldVerifyResult> {
    const proofSource = isRecordValue(input.proofPayload.proof)
      ? input.proofPayload.proof
      : input.proofPayload;
    const isExplicitInvalid =
      isRecordValue(proofSource) &&
      "valid" in proofSource &&
      (proofSource as { valid?: boolean }).valid === false;

    const resolvedSessionId =
      input.sessionId ??
      extractSessionId(input.proofPayload) ??
      (input.walletAddress ? `wallet:${input.walletAddress}` : undefined);
    const resolvedNullifierHash =
      input.nullifierHash ?? extractNullifier(input.proofPayload);

    return {
      isValid: !isExplicitInvalid,
      sessionId: resolvedSessionId,
      nullifierHash: resolvedNullifierHash
    };
  }
}
