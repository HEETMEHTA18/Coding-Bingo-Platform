// server/routes/leaderboardRoutes.ts
import { Router } from "express";
import { LeaderboardController } from "../controllers/LeaderboardController";

const router = Router();

router.get("/", LeaderboardController.getRoomLeaderboard);
router.get("/all", LeaderboardController.getAllRoomsLeaderboard);

export default router;