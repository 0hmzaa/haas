import express from "express";
import worldRoutes from "./routes/world.routes.js";
import workersRoutes from "./routes/workers.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import { notFound } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

export const app = express();

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

app.use(notFound);
app.use(errorHandler);
