import { AppError } from "../../lib/app-error.js";
import { getWorldConfig } from "../../config/world.config.js";
import type {
  WorldVerificationAdapter,
  WorldVerifyInput,
  WorldVerifyResult
} from "./world.adapter.js";

type WorldVerifyApiResponse = {
  success?: boolean;
  verified?: boolean;
  isValid?: boolean;
  valid?: boolean;
  code?: string;
  detail?: string;
  message?: string;
  session_id?: string;
  sessionId?: string;
  nullifier_hash?: string;
  nullifierHash?: string;
};

function getBooleanStatus(payload: WorldVerifyApiResponse): boolean {
  if (typeof payload.success === "boolean") {
    return payload.success;
  }

  if (typeof payload.verified === "boolean") {
    return payload.verified;
  }

  if (typeof payload.isValid === "boolean") {
    return payload.isValid;
  }

  if (typeof payload.valid === "boolean") {
    return payload.valid;
  }

  if (typeof payload.code === "string") {
    return payload.code.toLowerCase() === "success";
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class HttpWorldVerificationAdapter implements WorldVerificationAdapter {
  private readonly config = getWorldConfig();

  async verify(input: WorldVerifyInput): Promise<WorldVerifyResult> {
    if (!this.config.verifyUrl) {
      throw new AppError(
        "WORLD_ID_VERIFY_URL or WORLD_ID_APP_ID is required in WORLD_ID_MODE=live",
        500
      );
    }

    const fetchFn = globalThis.fetch;
    if (typeof fetchFn !== "function") {
      throw new AppError("Global fetch is not available for World verification", 500);
    }

    const signalTimeout = AbortSignal.timeout(this.config.timeoutMs);
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (this.config.apiKey) {
      headers.authorization = `Bearer ${this.config.apiKey}`;
    }

    const mergedProofPayload = isRecord(input.proof) ? input.proof : { proof: input.proof };
    const body = {
      ...mergedProofPayload,
      session_id: input.sessionId,
      nullifier_hash: input.nullifierHash
    };

    let response: Response;
    try {
      response = await fetchFn(this.config.verifyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: signalTimeout
      });
    } catch {
      throw new AppError("World verification provider is unreachable", 502);
    }

    let payload: WorldVerifyApiResponse = {};
    try {
      payload = (await response.json()) as WorldVerifyApiResponse;
    } catch {
      payload = {};
    }

    if (!response.ok && response.status >= 500) {
      throw new AppError("World verification provider failed", 502);
    }

    const responseSessionId =
      typeof payload.session_id === "string"
        ? payload.session_id
        : typeof payload.sessionId === "string"
          ? payload.sessionId
          : input.sessionId;
    const responseNullifierHash =
      typeof payload.nullifier_hash === "string"
        ? payload.nullifier_hash
        : typeof payload.nullifierHash === "string"
          ? payload.nullifierHash
          : input.nullifierHash;

    const statusIsValid = getBooleanStatus(payload);
    const idsMatch =
      responseSessionId === input.sessionId &&
      responseNullifierHash === input.nullifierHash;

    return {
      isValid: response.ok && statusIsValid && idsMatch,
      sessionId: responseSessionId,
      nullifierHash: responseNullifierHash
    };
  }
}
