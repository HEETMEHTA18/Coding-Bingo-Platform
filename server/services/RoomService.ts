// server/services/RoomService.ts
import { RoomModel } from "../models/Room";
import { QuestionModel } from "../models/Question";
import { TeamModel } from "../models/Team";
import { QuestionService } from "./QuestionService";
import type { RoomCode, Room } from "@shared/api";

export class RoomService {
  static async createRoom(code: string, title: string, durationMinutes?: number | null): Promise<Room> {
    const roomCode = code.toUpperCase() as RoomCode;
    const now = Date.now();
    const roundEndAt = durationMinutes ? now + durationMinutes * 60 * 1000 : null;

    const room = await RoomModel.create(roomCode, title, roundEndAt);
    await QuestionModel.initialize(roomCode);

    return room;
  }

  static async getRoomByCode(code: string): Promise<Room | null> {
    return await RoomModel.findByCode(code.toUpperCase() as RoomCode);
  }

  static async extendRoomTimer(code: string, minutes: number): Promise<Room | null> {
    return await RoomModel.extendTimer(code.toUpperCase() as RoomCode, minutes);
  }

  static async forceEndRoom(code: string): Promise<Room | null> {
    const roomCode = code.toUpperCase() as RoomCode;
    const room = await RoomModel.forceEnd(roomCode);

    if (room) {
      await TeamModel.forceEndAllInRoom(roomCode, Date.now());
    }

    return room;
  }

  static async initializeTimer(code: string, defaultMinutes: number = 30): Promise<Room | null> {
    const roomCode = code.toUpperCase() as RoomCode;
    const room = await RoomModel.findByCode(roomCode);

    if (!room || room.roundEndAt) return room;

    const now = Date.now();
    return await RoomModel.update(roomCode, {
      roundEndAt: now + defaultMinutes * 60 * 1000
    });
  }

  static async seedDemoRoom(code: string): Promise<void> {
    const roomCode = code.toUpperCase() as RoomCode;

    if (!(await RoomModel.exists(roomCode))) {
      await this.createRoom(roomCode, `${roomCode} Room`);
    }

    const existingQuestions = await QuestionModel.getByRoom(roomCode);
    if (existingQuestions.length === 0) {
      const questions = QuestionService.generateDemoQuestions();
      await QuestionModel.createBatchWithIds(roomCode, questions);
    }
  }

  static isTimerExpired(room: Room): boolean {
    if (!room.roundEndAt) return false;
    return Date.now() > room.roundEndAt;
  }
}
