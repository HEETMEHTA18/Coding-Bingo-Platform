
// server/services/GameService.ts
import { TeamService } from "./TeamService";
import { QuestionService } from "./QuestionService";
import { RoomService } from "./RoomService";
import { ProgressModel } from "../models/Progress";
import type { TeamID, QuestionID, SubmissionResult } from "@shared/api";

export class GameService {
  static async submitAnswer(
    teamId: TeamID,
    questionId: QuestionID,
    answer: string
  ): Promise<SubmissionResult | null> {
    const team = await TeamService.getTeamById(teamId);
    if (!team) return null;

    const room = await RoomService.getRoomByCode(team.room_code);
    if (!room) return null;

    // Check if time is up
    if (RoomService.isTimerExpired(room)) {
      return {
        status: "disabled",
        is_real: false,
        filled_cell: null,
        lines_completed: team.lines_completed,
        win: Boolean(team.end_time),
        solved_positions: await ProgressModel.getSolvedPositions(teamId),
      };
    }

    // Validate answer
    if (!answer.trim()) {
      return {
        status: "empty",
        is_real: false,
        filled_cell: null,
        lines_completed: team.lines_completed,
        win: Boolean(team.end_time),
        solved_positions: await ProgressModel.getSolvedPositions(teamId),
      };
    }

    const question = await QuestionService.getQuestionById(team.room_code, questionId);
    if (!question) return null;

    // Check if already solved
    if (await ProgressModel.hasSolvedQuestion(teamId, questionId)) {
      return {
        status: "already_solved",
        is_real: question.is_real,
        filled_cell: null,
        lines_completed: team.lines_completed,
        win: Boolean(team.end_time),
        solved_positions: await ProgressModel.getSolvedPositions(teamId),
      };
    }

    // Handle fake questions
    if (!question.is_real) {
      const isCorrect = answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
      if (isCorrect) {
        return {
          status: "fake",
          is_real: false,
          filled_cell: null,
          lines_completed: team.lines_completed,
          win: Boolean(team.end_time),
          solved_positions: await ProgressModel.getSolvedPositions(teamId),
        };
      } else {
        return {
          status: "incorrect",
          is_real: false,
          filled_cell: null,
          lines_completed: team.lines_completed,
          win: Boolean(team.end_time),
          solved_positions: await ProgressModel.getSolvedPositions(teamId),
        };
      }
    }

    // Check answer correctness
    const isCorrect = answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();

    if (!isCorrect) {
      return {
        status: "incorrect",
        is_real: true,
        filled_cell: null,
        lines_completed: team.lines_completed,
        win: Boolean(team.end_time),
        solved_positions: await ProgressModel.getSolvedPositions(teamId),
      };
    }

    // Correct answer - fill random position
    const available = await ProgressModel.getAvailablePositions(teamId);
    let filledCell: string | null = null;

    if (available.length > 0) {
      filledCell = available[Math.floor(Math.random() * available.length)];
      await ProgressModel.addSolvedPosition(teamId, filledCell);
      await ProgressModel.markQuestionSolved(teamId, questionId);
    }

    const lines = await ProgressModel.calculateLines(teamId);
    await TeamService.updateTeamLines(teamId, lines);

    let win = false;
    if (lines >= 5 && !team.end_time) {
      await TeamService.markTeamWin(teamId);
      win = true;
    }

    return {
      status: "correct",
      is_real: true,
      filled_cell: filledCell,
      lines_completed: lines,
      win,
      solved_positions: await ProgressModel.getSolvedPositions(teamId),
    };
  }
}
