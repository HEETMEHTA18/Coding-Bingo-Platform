// server/services/TeamService.ts
import { TeamModel } from "../models/Team";
import { ProgressModel } from "../models/Progress";
import { RoomService } from "./RoomService";
import type { Team, TeamID, RoomCode } from "@shared/api";

export class TeamService {
  static generateTeamId(): TeamID {
    return `team_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }

  static async createTeam(teamName: string, roomCode: string): Promise<{ team: Team; error?: string } | null> {
    const code = roomCode.toUpperCase() as RoomCode;

    // Check if room exists
    const room = await RoomService.getRoomByCode(code);
    if (!room) {
      return null;
    }

    // Check for duplicate team name
    const existing = await TeamModel.findByNameInRoom(teamName, code);
    if (existing) {
      return null;
    }

    const teamId = this.generateTeamId();
    const now = Date.now();

    // Initialize room timer if not started
    await RoomService.initializeTimer(code);

    const team = await TeamModel.create(teamId, teamName.trim(), code, now);
    await ProgressModel.initializeTeam(teamId);

    return { team };
  }

  static async getTeamById(teamId: TeamID): Promise<Team | null> {
    return await TeamModel.findById(teamId);
  }

  static async getTeamsByRoom(roomCode: string): Promise<Team[]> {
    return await TeamModel.getByRoom(roomCode.toUpperCase() as RoomCode);
  }

  static async updateTeamLines(teamId: TeamID, lines: number): Promise<Team | null> {
    return await TeamModel.update(teamId, { lines_completed: lines });
  }

  static async markTeamWin(teamId: TeamID): Promise<Team | null> {
    return await TeamModel.update(teamId, { end_time: Date.now() });
  }
}