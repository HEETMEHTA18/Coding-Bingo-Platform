// server/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./routes";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use("/api", routes);

  return app;
}
