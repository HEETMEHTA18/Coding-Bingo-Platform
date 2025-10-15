
// server/services/LeaderboardService.ts
import { TeamModel } from "../models/Team";
import type { LeaderboardRow, LeaderboardAllRow, RoomCode } from "@shared/api";

export class LeaderboardService {
  static async getRoomLeaderboard(roomCode: string): Promise<LeaderboardRow[]> {
    const code = roomCode.toUpperCase() as RoomCode;
    const teams = await TeamModel.getByRoom(code);

    return teams
      .map(team => ({
        team_name: team.team_name,
        lines_completed: team.lines_completed,
        time_taken_ms: (team.end_time ?? Date.now()) - team.start_time,
      }))
      .sort((a, b) => {
        if (b.lines_completed !== a.lines_completed) {
          return b.lines_completed - a.lines_completed;
        }
        return a.time_taken_ms - b.time_taken_ms;
      })
      .map((row, idx) => ({
        ...row,
        rank: idx + 1,
      }));
  }

  static async getAllRoomsLeaderboard(): Promise<LeaderboardAllRow[]> {
    const teams = await TeamModel.getAllTeams();

    return teams
      .map(team => ({
        team_name: team.team_name,
        lines_completed: team.lines_completed,
        time_taken_ms: (team.end_time ?? Date.now()) - team.start_time,
        room_code: team.room_code,
      }))
      .sort((a, b) => {
        if (b.lines_completed !== a.lines_completed) {
          return b.lines_completed - a.lines_completed;
        }
        return a.time_taken_ms - b.time_taken_ms;
      })
      .map((row, idx) => ({
        ...row,
        rank: idx + 1,
      }));
  }
}
