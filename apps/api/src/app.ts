import express from "express";
import worldRoutes from "./routes/world.routes.js";
import workersRoutes from "./routes/workers.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import x402Routes from "./routes/x402.routes.js";
import reputationRoutes from "./routes/reputation.routes.js";
import hederaRoutes from "./routes/hedera.routes.js";
import { notFound } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "human-as-a-service-api"
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "human-as-a-service-api"
  });
});

app.use("/api/world", worldRoutes);
app.use("/api/workers", workersRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/reputation", reputationRoutes);
app.use("/api", x402Routes);
app.use("/api", hederaRoutes);

app.use(notFound);
app.use(errorHandler);
