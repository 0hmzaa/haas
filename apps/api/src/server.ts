import { app } from "./app.js";
import { ReviewWindowWatcherService } from "./services/hedera/review-window-watcher.service.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const reviewWindowWatcher = new ReviewWindowWatcherService();

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  reviewWindowWatcher.start();
});

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down API`);
  reviewWindowWatcher.stop();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
