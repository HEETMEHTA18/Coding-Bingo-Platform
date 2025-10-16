// server/controllers/GameController.ts
import { Request, Response } from "express";
import { TeamService } from "../services/TeamService";
import { QuestionService } from "../services/QuestionService";
import { RoomService } from "../services/RoomService";
import { GameService } from "../services/GameService";
import { ProgressModel } from "../models/Progress";
import type { GameStateResponse, ErrorResponse } from "@shared/api";
import { seededShuffle } from "../utils/seededShuffle";

export class GameController {
  static async getGameState(req: Request, res: Response) {
    const teamId = String(req.query.teamId || "");

    if (!teamId) {
      return res.status(400).json({
        ok: false,
        error: "Missing teamId",
      } as ErrorResponse);
    }

    const team = await TeamService.getTeamById(teamId);
    if (!team) {
      return res.status(404).json({
        ok: false,
        error: "Team not found",
      } as ErrorResponse);
    }

    const room = await RoomService.getRoomByCode(team.room_code);
    if (!room) {
      return res.status(404).json({
        ok: false,
        error: "Room not found",
      } as ErrorResponse);
    }

    const questions = await QuestionService.getQuestionsByRoom(team.room_code);
    const solvedPositions = await ProgressModel.getSolvedPositions(teamId);

    // Deterministically shuffle questions for this team in this room
    const seed = `${team.team_id}:${team.room_code}`;
    const shuffledQuestions = seededShuffle(questions, seed);

    const response: GameStateResponse = {
      team,
      room,
      questions: shuffledQuestions.map(q => ({
        question_id: q.question_id,
        question_text: q.question_text,
        is_real: q.is_real,
      })),
      solved_positions: solvedPositions,
    };

    res.json(response);
  }

  static async submitAnswer(req: Request, res: Response) {
    const teamId = String(req.body.teamId || "");
    const questionId = Number(req.body.questionId);
    const answer = String(req.body.answer ?? "");

    if (!teamId) {
      return res.status(400).json({
        ok: false,
        error: "Missing teamId",
      } as ErrorResponse);
    }

    if (!questionId) {
      return res.status(400).json({
        ok: false,
        error: "Missing questionId",
      } as ErrorResponse);
    }

    const result = await GameService.submitAnswer(teamId, questionId, answer);

    if (!result) {
      return res.status(404).json({
        ok: false,
        error: "Team or question not found",
      } as ErrorResponse);
    }

    res.json(result);
  }
}