// server/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./routes";
import { RoomService } from "./services/RoomService";

// Initialize demo room on server start
async function initializeApp() {
  await RoomService.seedDemoRoom("DEMO");
  console.log("✅ Demo room initialized");
}

export function createServer() {
  initializeApp();

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use("/api", routes);

  return app;
}