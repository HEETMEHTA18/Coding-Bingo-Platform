// server/controllers/AdminController.ts
import { Request, Response } from "express";
import { RoomService } from "../services/RoomService";
import { QuestionService } from "../services/QuestionService";
import { TeamService } from "../services/TeamService";
import { RoomModel } from "../models/Room";
import { db } from "../db";
import { rooms, teams } from "../schema";
import { eq } from "drizzle-orm";
import type {
  AdminCreateRoomRequest,
  AdminStateResponse,
  AdminAddQuestionRequest,
  AdminDeleteQuestionRequest,
  AdminStartRequest,
  AdminForceEndRequest,
  ErrorResponse,
} from "@shared/api";

export class AdminController {
  static async createRoom(req: Request, res: Response) {
    const { code, title, durationMinutes } = (req.body || {}) as AdminCreateRoomRequest;

    if (!code || !title) {
      return res.status(400).json({
        ok: false,
        error: "Missing code/title",
      } as ErrorResponse);
    }

    const room = await RoomService.createRoom(code, title, durationMinutes);
    res.json(room);
  }

  static async seedDemo(req: Request, res: Response) {
    const code = String(req.body.room || "").toUpperCase();

    if (!code) {
      return res.status(400).json({
        ok: false,
        error: "Missing room",
      } as ErrorResponse);
    }

    await RoomService.seedDemoRoom(code);
    res.json({ ok: true });
  }

  static async getState(req: Request, res: Response) {
    const code = String(req.query.room || "").toUpperCase();

    const room = await RoomService.getRoomByCode(code);
    if (!room) {
      return res.status(404).json({
        ok: false,
        error: "Invalid room code",
      } as ErrorResponse);
    }

    const questions = await QuestionService.getQuestionsByRoom(code);
    const teams = await TeamService.getTeamsByRoom(code);

    const response: AdminStateResponse = {
      room,
      questions,
      teams,
    };

    res.json(response);
  }

  static async addQuestion(req: Request, res: Response) {
    const { room, question_text, correct_answer, is_real } = (req.body || {}) as AdminAddQuestionRequest;
    const code = String(room || "").toUpperCase();

    if (!(await RoomService.getRoomByCode(code))) {
      return res.status(404).json({
        ok: false,
        error: "Invalid room",
      } as ErrorResponse);
    }

    const question = await QuestionService.addQuestion(code, question_text, correct_answer, is_real);
    res.json(question);
  }

  static async deleteQuestion(req: Request, res: Response) {
    const { room, question_id } = (req.body || {}) as AdminDeleteQuestionRequest;
    const code = String(room || "").toUpperCase();

    if (!(await RoomService.getRoomByCode(code))) {
      return res.status(404).json({
        ok: false,
        error: "Invalid room",
      } as ErrorResponse);
    }

    const success = await QuestionService.deleteQuestion(code, Number(question_id));
    res.json({ ok: success });
  }

  static async startTimer(req: Request, res: Response) {
    const { minutes } = (req.body || {}) as AdminStartRequest;

    if (!minutes || minutes <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Invalid minutes",
      } as ErrorResponse);
    }

    const now = Date.now();
    const endTime = now + Number(minutes) * 60 * 1000;

    await db.update(rooms).set({ roundEndAt: new Date(endTime) });

    res.json({ ok: true, endTime });
  }

  static async extendTimer(req: Request, res: Response) {
    const { minutes } = req.body || {};

    if (!minutes || minutes <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Invalid minutes",
      } as ErrorResponse);
    }

    const addMs = Number(minutes) * 60 * 1000;
    const now = Date.now();

    const allRooms = await db.select().from(rooms);
    for (const room of allRooms) {
      let newEnd = room.roundEndAt ? room.roundEndAt.getTime() + addMs : now + addMs;
      if (newEnd < now) newEnd = now + addMs;
      await db.update(rooms).set({ roundEndAt: new Date(newEnd) }).where(eq(rooms.code, room.code));
    }

    res.json({ ok: true });
  }

  static async forceEnd(req: Request, res: Response) {
    const now = new Date();

    await db.update(rooms).set({ roundEndAt: now });
    await db.update(teams).set({ endTime: now }).where(eq(teams.endTime, null));

    res.json({ ok: true });
  }
}
