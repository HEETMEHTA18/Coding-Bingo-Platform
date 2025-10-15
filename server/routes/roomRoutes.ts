// server/routes/roomRoutes.ts
import { Router } from "express";
import { RoomController } from "../controllers/RoomController";

const router = Router();

router.get("/:code", RoomController.getRoomByCode);
router.post("/extend-timer", RoomController.extendTimer);

export default router;