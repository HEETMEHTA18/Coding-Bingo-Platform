// server/models/Team.ts
import { db } from "../db";
import { teams } from "../schema";
import { eq, and, ilike } from "drizzle-orm";
import type { TeamID, Team as TeamType, RoomCode } from "@shared/api";

export class TeamModel {
  static async create(
    teamId: TeamID,
    teamName: string,
    roomCode: RoomCode,
    startTime: number
  ): Promise<TeamType> {
    await db.insert(teams).values({
      teamId,
      teamName,
      roomCode,
      startTime: new Date(startTime),
      linesCompleted: 0,
      endTime: null,
    });
    return {
      team_id: teamId,
      team_name: teamName,
      room_code: roomCode,
      start_time: startTime,
      lines_completed: 0,
      end_time: null,
    };
  }

  static async findById(teamId: TeamID): Promise<TeamType | null> {
    const result = await db.select().from(teams).where(eq(teams.teamId, teamId)).limit(1);
    if (result.length === 0) return null;
    const row = result[0];
    return {
      team_id: row.teamId,
      team_name: row.teamName,
      room_code: row.roomCode,
      start_time: row.startTime.getTime(),
      lines_completed: row.linesCompleted,
      end_time: row.endTime ? row.endTime.getTime() : null,
    };
  }

  static async findByNameInRoom(teamName: string, roomCode: RoomCode): Promise<TeamType | null> {
    const result = await db.select().from(teams).where(and(eq(teams.roomCode, roomCode), ilike(teams.teamName, teamName))).limit(1);
    if (result.length === 0) return null;
    const row = result[0];
    return {
      team_id: row.teamId,
      team_name: row.teamName,
      room_code: row.roomCode,
      start_time: row.startTime.getTime(),
      lines_completed: row.linesCompleted,
      end_time: row.endTime ? row.endTime.getTime() : null,
    };
  }

  static async getByRoom(roomCode: RoomCode): Promise<TeamType[]> {
    const result = await db.select().from(teams).where(eq(teams.roomCode, roomCode));
    return result.map(row => ({
      team_id: row.teamId,
      team_name: row.teamName,
      room_code: row.roomCode,
      start_time: row.startTime.getTime(),
      lines_completed: row.linesCompleted,
      end_time: row.endTime ? row.endTime.getTime() : null,
    }));
  }

  static async getAllTeams(): Promise<TeamType[]> {
    const result = await db.select().from(teams);
    return result.map(row => ({
      team_id: row.teamId,
      team_name: row.teamName,
      room_code: row.roomCode,
      start_time: row.startTime.getTime(),
      lines_completed: row.linesCompleted,
      end_time: row.endTime ? row.endTime.getTime() : null,
    }));
  }

  static async update(teamId: TeamID, updates: Partial<TeamType>): Promise<TeamType | null> {
    const updateData: any = {};
    if (updates.team_name !== undefined) updateData.teamName = updates.team_name;
    if (updates.lines_completed !== undefined) updateData.linesCompleted = updates.lines_completed;
    if (updates.end_time !== undefined) updateData.endTime = updates.end_time ? new Date(updates.end_time) : null;

    await db.update(teams).set(updateData).where(eq(teams.teamId, teamId));
    return this.findById(teamId);
  }

  static async forceEndAllInRoom(roomCode: RoomCode, endTime: number): Promise<void> {
    await db.update(teams).set({ endTime: new Date(endTime) }).where(and(eq(teams.roomCode, roomCode), eq(teams.endTime, null)));
  }
}
