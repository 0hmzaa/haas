export type ReconciliationWatcherConfig = {
  enabled: boolean;
  intervalMs: number;
  batchSize: number;
  runOnStartup: boolean;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getReconciliationWatcherConfig(): ReconciliationWatcherConfig {
  return {
    enabled: process.env.AUTO_RECONCILIATION_ENABLED !== "false",
    intervalMs: parsePositiveInt(process.env.AUTO_RECONCILIATION_INTERVAL_MS, 30_000),
    batchSize: parsePositiveInt(process.env.AUTO_RECONCILIATION_BATCH_SIZE, 25),
    runOnStartup: process.env.AUTO_RECONCILIATION_RUN_ON_START !== "false"
  };
}
