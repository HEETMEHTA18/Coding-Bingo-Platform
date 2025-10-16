// server/routes/adminRoutes.ts
import { Router } from "express";
import { AdminController } from "../controllers/AdminController";

const router = Router();

router.post("/create-room", AdminController.createRoom);
router.post("/seed-demo", AdminController.seedDemo);
router.get("/state", AdminController.getState);
router.post("/add-question", AdminController.addQuestion);
router.post("/delete-question", AdminController.deleteQuestion);
router.post("/start", AdminController.startTimer);
router.post("/extend-timer", AdminController.extendTimer);
router.post("/force-end", AdminController.forceEnd);

export default router;
