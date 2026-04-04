import { getReconciliationWatcherConfig } from "../../config/reconciliation.config.js";
import { ReconciliationService } from "./reconciliation.service.js";

export class ReviewWindowWatcherService {
  private readonly config = getReconciliationWatcherConfig();
  private readonly reconciliationService = new ReconciliationService();
  private intervalHandle: ReturnType<typeof globalThis.setInterval> | null = null;
  private cycleInProgress = false;

  start() {
    if (!this.config.enabled || this.intervalHandle) {
      return;
    }

    if (this.config.runOnStartup) {
      this.runCycle("startup").catch((error: unknown) => {
        console.error("[review-window-watcher] startup cycle failed", error);
      });
    }

    this.intervalHandle = globalThis.setInterval(() => {
      this.runCycle("interval").catch((error: unknown) => {
        console.error("[review-window-watcher] interval cycle failed", error);
      });
    }, this.config.intervalMs);

    this.intervalHandle.unref();

    console.log(
      `[review-window-watcher] enabled intervalMs=${this.config.intervalMs} batchSize=${this.config.batchSize}`
    );
  }

  stop() {
    if (!this.intervalHandle) {
      return;
    }

    globalThis.clearInterval(this.intervalHandle);
    this.intervalHandle = null;
    console.log("[review-window-watcher] stopped");
  }

  private async runCycle(reason: "startup" | "interval") {
    if (this.cycleInProgress) {
      return;
    }

    this.cycleInProgress = true;
    try {
      const result = await this.reconciliationService.reconcileExpiredReviewWindows({
        limit: this.config.batchSize
      });

      if (result.reconciled > 0 || result.errors.length > 0) {
        console.log(
          `[review-window-watcher] reason=${reason} scanned=${result.scanned} eligible=${result.eligible} reconciled=${result.reconciled} skipped=${result.skipped} errors=${result.errors.length}`
        );
      }
    } finally {
      this.cycleInProgress = false;
    }
  }
}
