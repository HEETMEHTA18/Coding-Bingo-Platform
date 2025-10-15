import { Request, Response } from "express";
import { LeaderboardService } from "../services/LeaderboardService";
import { RoomService } from "../services/RoomService";
import type { LeaderboardResponse, LeaderboardAllResponse, ErrorResponse } from "@shared/api";

export class LeaderboardController {
  static async getRoomLeaderboard(req: Request, res: Response) {
    const code = String(req.query.room || "").toUpperCase();

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

    const rows = await LeaderboardService.getRoomLeaderboard(code);

    const response: LeaderboardResponse = {
      room_code: code,
      rows,
      updated_at: Date.now(),
    };

    res.json(response);
  }

  static async getAllRoomsLeaderboard(req: Request, res: Response) {
    const rows = await LeaderboardService.getAllRoomsLeaderboard();

    const response: LeaderboardAllResponse = {
      rows,
      updated_at: Date.now(),
    };

    res.json(response);
  }
}
