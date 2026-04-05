import { AppError } from "../../lib/app-error.js";
import { getWorldConfig } from "../../config/world.config.js";
import type {
  WorldVerificationAdapter,
  WorldVerifyInput,
  WorldVerifyResult
} from "./world.adapter.js";
import {
  extractNullifierFromPayload,
  extractSessionIdFromPayload,
  isRecord,
  readString
} from "./world.adapter.js";

type WorldVerifyApiResponse = {
  success?: boolean;
  verified?: boolean;
  isValid?: boolean;
  valid?: boolean;
  status?: string;
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

  if (typeof payload.status === "string") {
    const normalizedStatus = payload.status.toLowerCase();
    return normalizedStatus === "success" || normalizedStatus === "verified";
  }

  return false;
}

function resolveSessionId(input: WorldVerifyInput, payload: Record<string, unknown>): string | undefined {
  const direct =
    input.sessionId ??
    extractSessionIdFromPayload(payload) ??
    (input.walletAddress ? `wallet:${input.walletAddress}` : undefined);

  if (direct) {
    return direct;
  }

  const action = readString(payload, "action");
  const nonce = readString(payload, "nonce");

  if (action && nonce) {
    return `wid4:${action}:${nonce}`;
  }

  return undefined;
}

function resolveNullifierHash(
  input: WorldVerifyInput,
  payload: Record<string, unknown>
): string | undefined {
  return input.nullifierHash ?? extractNullifierFromPayload(payload);
}

export class HttpWorldVerificationAdapter implements WorldVerificationAdapter {
  private readonly config = getWorldConfig();

  async verify(input: WorldVerifyInput): Promise<WorldVerifyResult> {
    if (!this.config.verifyUrl) {
      throw new AppError(
        "WORLD_ID_VERIFY_URL or WORLD_ID_RP_ID is required in WORLD_ID_MODE=live",
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

    let response: Response;
    try {
      response = await fetchFn(this.config.verifyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(input.proofPayload),
        signal: signalTimeout
      });
    } catch {
      throw new AppError("World verification provider is unreachable", 502);
    }

    let payload: Record<string, unknown> = {};
    try {
      const parsed = await response.json();
      payload = isRecord(parsed) ? parsed : {};
    } catch {
      payload = {};
    }

    if (!response.ok && response.status >= 500) {
      throw new AppError("World verification provider failed", 502);
    }

    const verificationPayload = {
      ...input.proofPayload,
      ...payload
    };
    const responseSessionId = resolveSessionId(input, verificationPayload);
    const responseNullifierHash = resolveNullifierHash(input, verificationPayload);

    const statusIsValid = getBooleanStatus(payload as WorldVerifyApiResponse);
    const isValid = response.ok && statusIsValid;

    if (isValid && (!responseSessionId || !responseNullifierHash)) {
      throw new AppError("World verification response missing session or nullifier", 400);
    }

    return {
      isValid,
      sessionId: responseSessionId,
      nullifierHash: responseNullifierHash
    };
  }
}
