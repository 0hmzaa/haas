export type WorldConfig = {
  mode: "mock" | "live";
  verifyUrl?: string;
  appId?: string;
  rpId?: string;
  rpSigningKey?: string;
  workerOnboardingAction: string;
  signatureTtlSeconds: number;
  apiKey?: string;
  timeoutMs: number;
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function getWorldConfig(): WorldConfig {
  const mode = process.env.WORLD_ID_MODE === "live" ? "live" : "mock";
  const configuredVerifyUrl = process.env.WORLD_ID_VERIFY_URL;
  const appId = process.env.WORLD_ID_APP_ID;
  const rpId = process.env.WORLD_ID_RP_ID;
  const rpSigningKey = process.env.WORLD_ID_RP_SIGNING_KEY;
  const workerOnboardingAction =
    process.env.WORLD_ID_ACTION_WORKER_ONBOARDING ?? "worker-onboarding";
  const signatureTtlSecondsFromEnv = Number(
    process.env.WORLD_ID_SIGNATURE_TTL_SECONDS ?? "300"
  );
  const timeoutFromEnv = Number(process.env.WORLD_ID_TIMEOUT_MS ?? "8000");

  let verifyUrl: string | undefined = undefined;

  if (isNonEmpty(configuredVerifyUrl)) {
    verifyUrl = configuredVerifyUrl;
  } else if (isNonEmpty(rpId)) {
    verifyUrl = `https://developer.worldcoin.org/api/v4/verify/${rpId}`;
  } else if (isNonEmpty(appId)) {
    verifyUrl = `https://developer.worldcoin.org/api/v2/verify/${appId}`;
  }

  return {
    mode,
    verifyUrl,
    appId: isNonEmpty(appId) ? appId : undefined,
    rpId: isNonEmpty(rpId) ? rpId : undefined,
    rpSigningKey: isNonEmpty(rpSigningKey) ? rpSigningKey : undefined,
    workerOnboardingAction,
    signatureTtlSeconds:
      Number.isFinite(signatureTtlSecondsFromEnv) && signatureTtlSecondsFromEnv > 0
        ? Math.floor(signatureTtlSecondsFromEnv)
        : 300,
    apiKey: isNonEmpty(process.env.WORLD_ID_API_KEY)
      ? process.env.WORLD_ID_API_KEY
      : undefined,
    timeoutMs: Number.isFinite(timeoutFromEnv) && timeoutFromEnv > 0 ? timeoutFromEnv : 8000
  };
}
