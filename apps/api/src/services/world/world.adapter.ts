export type WorldVerifyInput = {
  proofPayload: Record<string, unknown>;
  sessionId?: string;
  nullifierHash?: string;
  walletAddress?: string;
};

export type WorldVerifyResult = {
  isValid: boolean;
  sessionId?: string;
  nullifierHash?: string;
};

export interface WorldVerificationAdapter {
  verify(input: WorldVerifyInput): Promise<WorldVerifyResult>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(
  source: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export function extractNullifierFromPayload(
  payload: Record<string, unknown>
): string | undefined {
  const direct =
    readString(payload, "nullifier_hash", "nullifierHash") ??
    readString(payload, "nullifier");
  if (direct) {
    return direct;
  }

  const responses = payload.responses;
  if (!Array.isArray(responses)) {
    return undefined;
  }

  for (const item of responses) {
    if (!isRecord(item)) {
      continue;
    }

    const responseNullifier = readString(item, "nullifier");
    if (responseNullifier) {
      return responseNullifier;
    }

    const sessionNullifier = item.session_nullifier;
    if (Array.isArray(sessionNullifier)) {
      const candidate = sessionNullifier.find(
        (value): value is string => typeof value === "string" && value.length > 0
      );
      if (candidate) {
        return candidate;
      }
    }
  }

  return undefined;
}

export function extractSessionIdFromPayload(
  payload: Record<string, unknown>
): string | undefined {
  return readString(payload, "session_id", "sessionId");
}
