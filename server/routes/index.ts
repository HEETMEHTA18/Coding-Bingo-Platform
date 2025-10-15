// server/routes/index.ts
import { Router } from "express";
import authRoutes from "./authRoutes";
import roomRoutes from "./roomRoutes";
import gameRoutes from "./gameRoutes";
import leaderboardRoutes from "./leaderboardRoutes";
import adminRoutes from "./adminRoutes";
import { handleDemo } from "./demo";

const router = Router();

// Health check
router.get("/ping", (_req, res) => {
  const ping = process.env.PING_MESSAGE ?? "ping";
  res.json({ message: ping });
});

// Demo endpoint
router.get("/demo", handleDemo);

// Route modules
router.use("/", authRoutes);
router.use("/rooms", roomRoutes);
router.use("/", gameRoutes);
router.use("/leaderboard", leaderboardRoutes);
router.use("/admin", adminRoutes);

export default router;