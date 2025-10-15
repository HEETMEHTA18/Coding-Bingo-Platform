import { Request, Response } from "express";
import { TeamService } from "../services/TeamService";
import { RoomService } from "../services/RoomService";
import type { LoginRequest, LoginResponse, ErrorResponse } from "@shared/api";

export class AuthController {
  static async login(req: Request, res: Response) {
    const { team_name, room_code } = (req.body || {}) as LoginRequest;

    // Validation
    if (!team_name || !team_name.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Team name is required",
      } as ErrorResponse);
    }

    if (!room_code || !room_code.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Room code is required",
      } as ErrorResponse);
    }

    // Check if room exists
    const room = await RoomService.getRoomByCode(room_code);
    if (!room) {
      return res.status(400).json({
        ok: false,
        error: "Invalid room code",
      } as ErrorResponse);
    }

    // Create team
    const result = await TeamService.createTeam(team_name, room_code);
    if (!result) {
      return res.status(400).json({
        ok: false,
        error: "This team name already exists",
      } as ErrorResponse);
    }

    const response: LoginResponse = {
      ok: true,
      team: result.team,
      room,
    };

    res.json(response);
  }
}
