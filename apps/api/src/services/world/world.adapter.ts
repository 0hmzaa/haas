export type WorldVerifyInput = {
  proof: unknown;
  sessionId: string;
  nullifierHash: string;
};

export type WorldVerifyResult = {
  isValid: boolean;
  sessionId: string;
  nullifierHash: string;
};

export interface WorldVerificationAdapter {
  verify(input: WorldVerifyInput): Promise<WorldVerifyResult>;
}
