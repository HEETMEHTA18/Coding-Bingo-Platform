import { Request, Response } from "express";
import { RoomService } from "../services/RoomService";
import type { ErrorResponse } from "@shared/api";

export class RoomController {
  static async getRoomByCode(req: Request, res: Response) {
    const code = req.params.code.toUpperCase();
    const room = await RoomService.getRoomByCode(code);

    if (!room) {
      return res.status(404).json({
        ok: false,
        error: "Invalid room code",
      } as ErrorResponse);
    }

    res.json(room);
  }

  static async extendTimer(req: Request, res: Response) {
    const code = String(req.body.room || "").toUpperCase();
    const minutes = Number(req.body.minutes || 0);

    if (!code) {
      return res.status(400).json({
        ok: false,
        error: "Room code is required",
      } as ErrorResponse);
    }

    const room = await RoomService.getRoomByCode(code);
    if (!room) {
      return res.status(400).json({
        ok: false,
        error: "Invalid room code",
      } as ErrorResponse);
    }

    if (!minutes || minutes <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Invalid minutes",
      } as ErrorResponse);
    }

    const updated = await RoomService.extendRoomTimer(code, minutes);
    res.json(updated);
  }
}
