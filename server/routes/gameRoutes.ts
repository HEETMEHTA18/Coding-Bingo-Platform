// server/routes/gameRoutes.ts
import { Router } from "express";
import { GameController } from "../controllers/GameController";

const router = Router();

router.get("/game-state", GameController.getGameState);
router.post("/submit", GameController.submitAnswer);

export default router;