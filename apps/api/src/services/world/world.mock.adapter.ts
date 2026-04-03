import type {
  WorldVerificationAdapter,
  WorldVerifyInput,
  WorldVerifyResult
} from "./world.adapter.js";

export class MockWorldVerificationAdapter implements WorldVerificationAdapter {
  async verify(input: WorldVerifyInput): Promise<WorldVerifyResult> {
    const isExplicitInvalid =
      typeof input.proof === "object" &&
      input.proof !== null &&
      "valid" in input.proof &&
      (input.proof as { valid?: boolean }).valid === false;

    return {
      isValid: !isExplicitInvalid,
      sessionId: input.sessionId,
      nullifierHash: input.nullifierHash
    };
  }
}
